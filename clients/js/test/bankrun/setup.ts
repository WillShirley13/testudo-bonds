import {
    type Address,
    pipe,
    KeyPairSigner,
    generateKeyPairSigner,
    lamports,
    createTransactionMessage,
    appendTransactionMessageInstructions,
    setTransactionMessageLifetimeUsingBlockhash,
    signTransactionMessageWithSigners,
    setTransactionMessageFeePayerSigner,
    fetchEncodedAccount
} from '@solana/kit';
import { Keypair, PublicKey, Transaction, Ed25519Keypair } from '@solana/web3.js';
import {
    findAssociatedTokenPda,
    TOKEN_PROGRAM_ADDRESS,
    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    getInitializeMintInstruction,
    getMintSize,
    getMintToInstruction,
    getCreateAssociatedTokenIdempotentInstructionAsync,
} from '@solana-program/token';
import { getCreateAccountInstruction } from '@solana-program/system';
import { Clock, LiteSVM } from 'litesvm';
import * as sdk from '../../src/index.js';

export const LAMPORTS_PER_SOL = 1_000_000_000;
export const TESTUDO_DECIMALS = 9;
export const SHELLS_PER_TESTUDO = 1_000_000_000; // 10^9
export const INITIAL_MINT_SUPPLY = 1_000_000 * SHELLS_PER_TESTUDO; // 1M TESTUDO tokens

export interface BankrunTestContext {
    // Bankrun context
    context: LiteSVM;

    // Core infrastructure keypairs
    adminAuthority: KeyPairSigner;
    treasuryKeypair: KeyPairSigner;
    teamKeypair: KeyPairSigner;
    mintKeypair: KeyPairSigner;

    // Derived addresses
    nativeTokenMint: Address;
    globalAdminPda: Address;
    rewardsPoolAta: Address;
    treasuryAta: Address;
    teamAta: Address;

    // Test user
    user: KeyPairSigner;
    userPda: Address;
    userAta: Address;

    // Test bond
    bondPda: Address;
    bondKeypair: KeyPairSigner;

    // Helper methods
    createFreshUser(): Promise<KeyPairSigner>;
    fundKeypair(keypair: KeyPairSigner, solAmount?: number): Promise<void>;
    mintTokensToUser(userKeypair: KeyPairSigner, amount: bigint): Promise<void>;
    createUserPda(userKeypair: KeyPairSigner): Promise<Address>;
    createAta(keypair: KeyPairSigner): Promise<Address>;
    advanceTime(seconds: bigint): Promise<void>;
    getCurrentTimestamp(): Promise<bigint>;
}

/**
 * Initialize a complete Bankrun test context with admin, user, and bond setup
 */
export async function getBankrunTestContext(): Promise<BankrunTestContext> {
    console.log('🏗️  Creating Bankrun test context...');

    // Start Bankrun with the testudo_bonds program
    const context = new LiteSVM();

    // Generate core infrastructure keypairs
    console.log('  🔑 Generating keypairs...');
    const adminAuthority = await generateKeyPairSigner();
    const treasuryKeypair = await generateKeyPairSigner();
    const teamKeypair = await generateKeyPairSigner();
    const mintKeypair = await generateKeyPairSigner();
    const user = await generateKeyPairSigner();
    const bondKeypair = await generateKeyPairSigner();

    console.log(`  Admin Authority: ${adminAuthority.address}`);
    console.log(`  Treasury: ${treasuryKeypair.address}`);
    console.log(`  Team: ${teamKeypair.address}`);
    console.log(`  Mint: ${mintKeypair.address}`);
    console.log(`  User: ${user.address}`);

    // Fund keypairs with SOL
    console.log('  💰 Funding keypairs with SOL...');
    await fundKeypair(context, adminAuthority, 10);
    await fundKeypair(context, treasuryKeypair, 2);
    await fundKeypair(context, teamKeypair, 2);
    await fundKeypair(context, user, 5);

    // Create the native token mint
    console.log('  🪙 Creating native token mint...');
    await createMint(context, mintKeypair, adminAuthority);

    // Derive deterministic addresses
    const nativeTokenMint: Address = mintKeypair.address;
    const globalAdminPda = (await sdk.findGlobalAdminPda())[0];

    // Derive ATA addresses
    const [rewardsPoolAta] = await findAssociatedTokenPda({
        owner: globalAdminPda,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        mint: nativeTokenMint,
    });
    const [treasuryAta] = await findAssociatedTokenPda({
        owner: treasuryKeypair.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        mint: nativeTokenMint,
    });
    const [teamAta] = await findAssociatedTokenPda({
        owner: teamKeypair.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        mint: nativeTokenMint,
    });
    const [userAta] = await findAssociatedTokenPda({
        owner: user.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        mint: nativeTokenMint,
    });

    console.log(`  Global Admin PDA: ${globalAdminPda}`);
    console.log(`  Rewards Pool ATA: ${rewardsPoolAta}`);
    console.log(`  Treasury ATA: ${treasuryAta}`);
    console.log(`  Team ATA: ${teamAta}`);
    console.log(`  User ATA: ${userAta}`);

    // Initialize the global admin
    console.log('  🔧 Initializing global admin...');
    await initializeGlobalAdmin(
        context,
        adminAuthority,
        treasuryKeypair.address,
        treasuryAta,
        teamKeypair.address,
        teamAta,
        rewardsPoolAta,
        nativeTokenMint
    );

    // Create user PDA
    console.log('  👤 Creating user PDA...');
    const userPda = await createUserPda(context, user);

    // Create user ATA and mint tokens
    console.log('  🪙 Creating user ATA and minting tokens...');
    await createAta(context, user, nativeTokenMint);
    await mintTokensToUser(
        context,
        mintKeypair,
        adminAuthority,
        userAta,
        BigInt(1000 * SHELLS_PER_TESTUDO)
    );

    // Create a bond
    console.log('  📄 Creating bond...');
    const bondPda = await createBond(
        context,
        user,
        userAta,
        nativeTokenMint,
        globalAdminPda,
        rewardsPoolAta,
        treasuryAta,
        teamAta
    );

    console.log('✅ Bankrun test context ready!');

    // Create the context object with helper methods
    const testContext: BankrunTestContext = {
        context,
        adminAuthority,
        treasuryKeypair,
        teamKeypair,
        mintKeypair,
        nativeTokenMint,
        globalAdminPda,
        rewardsPoolAta,
        treasuryAta,
        teamAta,
        user,
        userPda,
        userAta,
        bondPda,
        bondKeypair,

        // Helper methods
        createFreshUser: async (): Promise<KeyPairSigner> => {
            const newUser = await generateKeyPairSigner();
            await fundKeypair(context, newUser, 2);
            return newUser;
        },

        fundKeypair: async (
            keypair: KeyPairSigner,
            solAmount: number = 1
        ): Promise<void> => {
            await fundKeypair(context, keypair, solAmount);
        },

        mintTokensToUser: async (
            userKeypair: KeyPairSigner,
            amount: bigint
        ): Promise<void> => {
            const [userTokenAta] = await findAssociatedTokenPda({
                owner: userKeypair.address,
                tokenProgram: TOKEN_PROGRAM_ADDRESS,
                mint: nativeTokenMint,
            });

            await mintTokensToUser(
                context,
                mintKeypair,
                adminAuthority,
                userTokenAta,
                amount
            );
        },

        createUserPda: async (userKeypair: KeyPairSigner): Promise<Address> => {
            return await createUserPda(context, userKeypair);
        },

        createAta: async (keypair: KeyPairSigner): Promise<Address> => {
            return await createAta(context, keypair, nativeTokenMint);
        },

        advanceTime: async (seconds: bigint): Promise<void> => {
            const clock: Clock = await context.getClock();
            clock.unixTimestamp += seconds;
            await context.setClock(clock);
        },

        getCurrentTimestamp: async (): Promise<bigint> => {
            const clock = await context.getClock();
            return clock.unixTimestamp;
        },
    };

    return testContext;
}

/**
 * Fund a keypair with SOL using Bankrun
 */
async function fundKeypair(
    context: LiteSVM,
    keypair: KeyPairSigner,
    solAmount: number = 1
): Promise<void> {
    await context.airdrop(
        new PublicKey(keypair.address),
        BigInt(solAmount) * BigInt(LAMPORTS_PER_SOL)
    );
}

/**
 * Create the native token mint using Bankrun
 */
async function createMint(
    context: LiteSVM,
    mintKeypair: KeyPairSigner,
    mintAuthority: KeyPairSigner
): Promise<void> {
    const space = BigInt(getMintSize());
    const rent = await context.getRent();
    const requiredRent = rent.minimumBalance(space);

    const createAccountInstruction = getCreateAccountInstruction({
        payer: mintAuthority,
        newAccount: mintKeypair,
        lamports: requiredRent,
        space,
        programAddress: TOKEN_PROGRAM_ADDRESS,
    });

    const initializeMintInstruction = getInitializeMintInstruction({
        mint: mintKeypair.address,
        decimals: TESTUDO_DECIMALS,
        mintAuthority: mintAuthority.address,
        freezeAuthority: mintAuthority.address,
    });

    await executeTransaction(
        context,
        [createAccountInstruction, initializeMintInstruction],
        mintAuthority
    );
}

/**
 * Initialize the global admin using Bankrun
 */
async function initializeGlobalAdmin(
    context: LiteSVM,
    authority: KeyPairSigner,
    treasury: Address,
    treasuryAta: Address,
    team: Address,
    teamAta: Address,
    rewardsPoolAta: Address,
    nativeTokenMint: Address
): Promise<void> {
    const initAdminIx = await sdk.getInitializeAdminInstructionAsync({
        authority,
        rewardsPoolAta,
        treasury,
        treasuryAta,
        team,
        teamAta,
        nativeTokenMint,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    });

    await executeTransaction(context, [initAdminIx], authority);
}

/**
 * Create a user PDA using Bankrun
 */
async function createUserPda(
    context: LiteSVM,
    userKeypair: KeyPairSigner
): Promise<Address> {
    const [userPdaAddress] = await sdk.findUserPdaPda({
        userWallet: userKeypair.address,
    });

    const initUserIx = await sdk.getCreateUserInstructionAsync({
        userWallet: userKeypair,
    });

    await executeTransaction(context, [initUserIx], userKeypair);
    return userPdaAddress;
}

/**
 * Create an ATA using Bankrun
 */
async function createAta(
    context: LiteSVM,
    keypair: KeyPairSigner,
    mint: Address
): Promise<Address> {
    const [ataAddress] = await findAssociatedTokenPda({
        owner: keypair.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        mint,
    });

    const createAtaIx =
        await getCreateAssociatedTokenIdempotentInstructionAsync({
            payer: keypair,
            owner: keypair.address,
            mint,
        });

    await executeTransaction(context, [createAtaIx], keypair);
    return ataAddress;
}

/**
 * Mint tokens to a user using Bankrun
 */
async function mintTokensToUser(
    context: LiteSVM,
    mintKeypair: KeyPairSigner,
    mintAuthority: KeyPairSigner,
    destination: Address,
    amount: bigint
): Promise<void> {
    const mintToInstruction = getMintToInstruction({
        mint: mintKeypair.address,
        token: destination,
        mintAuthority: mintAuthority.address,
        amount,
    });

    await executeTransaction(context, [mintToInstruction], mintAuthority);
}

/**
 * Create a bond using Bankrun
 */
async function createBond(
    context: LiteSVM,
    user: KeyPairSigner,
    userAta: Address,
    nativeTokenMint: Address,
    globalAdminPda: Address,
    rewardsPoolAta: Address,
    treasuryAta: Address,
    teamAta: Address
): Promise<Address> {
    // Get UserPDA account
    const [userPda] = await sdk.findUserPdaPda({
        userWallet: user.address,
    });
    const UserPdaAccountInfo = context.getAccount(new PublicKey(userPda));
    if (!UserPdaAccountInfo) {
        throw new Error(`User PDA account not found at address: ${userPda}`);
    }
    const userPdaData = await sdk.getUserPdaCodec().decode(UserPdaAccountInfo.data);

    const [bondPda] = await sdk.findBondPda({
        userPda: userPda,
        bondIndex: userPdaData.bondIndex,
    });

    const createBondIx = await sdk.getInitializeBondInstructionAsync({
        userWallet: user,
        userWalletAta: userAta,
        rewardsPoolAta,
        treasuryAta,
        teamAta,
        nativeTokenMint,
    });

    await executeTransaction(context, [createBondIx], user);
    return bondPda;
}

/**
 * Execute a transaction using Bankrun
 */
async function executeTransaction(
    context: LiteSVM,
    instructions: any[],
    signer: KeyPairSigner
): Promise<void> {
    const latestBlockhash = await context.latestBlockhash();

    const tx = new Transaction().add(...instructions);
    const web3signer = new Keypair(signer.keyPair.privateKey as Ed25519Keypair);
    tx.sign(web3signer);

    await context.sendTransaction(tx as any);
}
