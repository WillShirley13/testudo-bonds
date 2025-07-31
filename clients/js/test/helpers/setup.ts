import {
    type Address,
    createSolanaRpc,
    createSolanaRpcSubscriptions,
    pipe,
    KeyPairSigner,
    generateKeyPairSigner,
    lamports,
    createTransactionMessage,
    appendTransactionMessageInstructions,
    setTransactionMessageFeePayer,
    setTransactionMessageLifetimeUsingBlockhash,
    signTransactionMessageWithSigners,
    sendAndConfirmTransactionFactory,
    setTransactionMessageFeePayerSigner,
} from '@solana/kit';
import {
    findAssociatedTokenPda,
    TOKEN_PROGRAM_ADDRESS,
    getInitializeMintInstruction,
    getMintSize,
    getMintToInstruction,
    getCreateAssociatedTokenIdempotentInstructionAsync,
} from '@solana-program/token';
import { getCreateAccountInstruction } from '@solana-program/system';
import * as sdk from '../../src/index.js';

export const LAMPORTS_PER_SOL = 1_000_000_000;
export const TESTUDO_DECIMALS = 9;
export const SHELLS_PER_TESTUDO = 1_000_000_000; // 10^9
export const INITIAL_MINT_SUPPLY = 1_000_000 * SHELLS_PER_TESTUDO   ; // 1M TESTUDO tokens

export interface TestContext {
    // RPC connections
    rpc: any;
    rpcSubscriptions: any;

    // Core infrastructure keypairs (SHARED across all tests)
    adminAuthority: KeyPairSigner;
    treasuryKeypair: KeyPairSigner;
    teamKeypair: KeyPairSigner;
    mintKeypair: KeyPairSigner;

    // Derived addresses (deterministic from shared keypairs)
    nativeTokenMint: Address;
    globalAdminPda: Address;
    rewardsPoolAta: Address;
    treasuryAta: Address;
    teamAta: Address;

    // Derived keypairs for user accounts (deterministic from shared keypairs)
    user1: KeyPairSigner;
    user2: KeyPairSigner;
    user3: KeyPairSigner;

    // Helper methods for creating fresh test data
    createFreshUser(): Promise<KeyPairSigner>;
    setNewAdminAuthority(): Promise<KeyPairSigner>;
    fundKeypair(keypair: KeyPairSigner, solAmount?: number): Promise<void>;
    mintTokensToUser(userKeypair: KeyPairSigner, amount: bigint): Promise<void>;
    createUserPda(userKeypair: KeyPairSigner): Promise<Address>;
    /**
     * Create (idempotently) the associated token account for the given user and
     * the test’s native token mint. Returns the ATA address so it can be used
     * as an instruction account.
     */
    createAta(keypair: KeyPairSigner): Promise<Address>;

    // Utility methods
    confirmTransaction(signature: string): Promise<void>;
    getLatestBlockhash(): Promise<any>;
}

// Module-level singleton storage
let globalTestContext: TestContext | null = null;

/**
 * Get the shared test context. Creates it once and reuses the same instance.
 * This ensures all tests share the same admin, treasury, team, and mint keypairs.
 */
export async function getTestContext(): Promise<TestContext> {
    if (!globalTestContext) {
        console.log('🏗️  Creating shared test context (ONE TIME ONLY)...');
        globalTestContext = await initializeTestContext();
        console.log('✅ Test context ready!');
    } else {
        console.log('♻️  Reusing existing test context...');
    }
    return globalTestContext;
}

/**
 * Initialize the test context with all shared infrastructure.
 * This is an expensive operation that should only happen once.
 */
async function initializeTestContext(): Promise<TestContext> {
    // Setup RPC connections
    const rpc = createSolanaRpc('http://127.0.0.1:8899');
    const rpcSubscriptions = createSolanaRpcSubscriptions(
        'ws://127.0.0.1:8900'
    );

    // Generate core infrastructure keypairs (these will be reused)
    console.log('  🔑 Generating keypairs...');
    var adminAuthority = await generateKeyPairSigner();
    const treasuryKeypair = await generateKeyPairSigner();
    const teamKeypair = await generateKeyPairSigner();
    const mintKeypair = await generateKeyPairSigner();
    const user1 = await generateKeyPairSigner();
    await fundKeypair(rpc, user1, 10);
    const user2 = await generateKeyPairSigner();
    await fundKeypair(rpc, user2, 10);
    const user3 = await generateKeyPairSigner();
    await fundKeypair(rpc, user3, 1);

    console.log(`  Admin Authority: ${adminAuthority.address}`);
    console.log(`  Treasury: ${treasuryKeypair.address}`);
    console.log(`  Team: ${teamKeypair.address}`);
    console.log(`  Mint: ${mintKeypair.address}`);

    // Fund the infrastructure keypairs with SOL
    console.log('  💰 Funding keypairs with SOL...');
    await fundKeypair(rpc, adminAuthority, 2); // Admin needs more for transactions
    await fundKeypair(rpc, treasuryKeypair, 1);
    await fundKeypair(rpc, teamKeypair, 1);

    // Create the native token mint
    console.log('  🪙 Creating native token mint...');
    await createMint(rpc, mintKeypair, adminAuthority);

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

    console.log(`  Global Admin PDA: ${globalAdminPda}`);
    console.log(`  Rewards Pool ATA: ${rewardsPoolAta}`);
    console.log(`  Treasury ATA: ${treasuryAta}`);
    console.log(`  Team ATA: ${teamAta}`);

    // Create the context object with helper methods
    const context: TestContext = {
        rpc,
        rpcSubscriptions,
        adminAuthority,
        treasuryKeypair,
        teamKeypair,
        mintKeypair,
        nativeTokenMint,
        globalAdminPda,
        rewardsPoolAta,
        treasuryAta,
        teamAta,
        user1,
        user2,
        user3,

        // Helper methods
        createFreshUser: async (): Promise<KeyPairSigner> => {
            const user = await generateKeyPairSigner();
            await fundKeypair(rpc, user, 1);
            return user;
        },

        setNewAdminAuthority: async (): Promise<KeyPairSigner> => {
            adminAuthority = await generateKeyPairSigner();
            await fundKeypair(rpc, adminAuthority, 1);
            return adminAuthority;
        },

        fundKeypair: async (
            keypair: KeyPairSigner,
            solAmount: number = 1
        ): Promise<void> => {
            await fundKeypair(rpc, keypair, solAmount);
        },

        mintTokensToUser: async (
            userKeypair: KeyPairSigner,
            amount: bigint
        ): Promise<void> => {
            const [userAta] = await findAssociatedTokenPda({
                owner: userKeypair.address,
                tokenProgram: TOKEN_PROGRAM_ADDRESS,
                mint: nativeTokenMint,
            });

            await mintTokensTo(
                rpc,
                mintKeypair,
                adminAuthority,
                userAta,
                amount
            );
        },

        createUserPda: async (userKeypair: KeyPairSigner): Promise<Address> => {
            // Get the user PDA address
            const [userPdaAddress] = await sdk.findUserPdaPda({
                userWallet: userKeypair.address,
            });

            // Create the instruction to create a user account
            const initUserIx = await sdk.getCreateUserInstructionAsync({
                userWallet: userKeypair,
            });

            // Get the latest blockhash
            const latestBlockhash = await rpc.getLatestBlockhash().send();

            // Create the transaction message
            const transactionMessage = pipe(
                createTransactionMessage({ version: 0 }),
                (tx) => setTransactionMessageFeePayerSigner(userKeypair, tx),
                (tx) =>
                    setTransactionMessageLifetimeUsingBlockhash(
                        latestBlockhash.value,
                        tx
                    ),
                (tx) => appendTransactionMessageInstructions([initUserIx], tx)
            );

            // Sign the transaction
            const signedTransaction =
                await signTransactionMessageWithSigners(transactionMessage);

            // Send the transaction
            const sendAndConfirm = sendAndConfirmTransactionFactory({
                rpc,
                rpcSubscriptions,
            });

            await sendAndConfirm(signedTransaction, {
                commitment: 'confirmed',
            });

            return userPdaAddress;
        },

        createAta: async (keypair: KeyPairSigner): Promise<Address> => {
            const [ataAddress] = await findAssociatedTokenPda({
                owner: keypair.address,
                tokenProgram: TOKEN_PROGRAM_ADDRESS,
                mint: nativeTokenMint,
            });

            const createAtaIx = await getCreateAssociatedTokenIdempotentInstructionAsync({
                payer: keypair,
                owner: keypair.address,
                mint: nativeTokenMint,
            });

            // Fetch a recent blockhash for transaction timing
            const blockhash = (await rpc.getLatestBlockhash().send()).value;

            // Build the transaction message
            const txMsg = pipe(
                createTransactionMessage({ version: 0 }),
                (tx) => setTransactionMessageFeePayer(keypair.address, tx),
                (tx) => setTransactionMessageLifetimeUsingBlockhash(blockhash, tx),
                (tx) => appendTransactionMessageInstructions([createAtaIx], tx)
            );

            // Sign the transaction with the user’s keypair
            const signedTx = await signTransactionMessageWithSigners(txMsg);

            // Send and confirm the transaction
            const sendAndConfirm = sendAndConfirmTransactionFactory({
                rpc,
                rpcSubscriptions,
            });

            await sendAndConfirm(signedTx, { commitment: 'confirmed' });

            return ataAddress;
        },

        confirmTransaction: async (signature: string): Promise<void> => {
            await confirmSignature(rpc, signature);
        },

        getLatestBlockhash: async () => {
            const response = await rpc.getLatestBlockhash().send();
            return response.value;
        },
    };

    return context;
}

/**
 * Fund a keypair with SOL for transaction fees
 */
async function fundKeypair(
    rpc: any,
    keypair: KeyPairSigner,
    solAmount: number = 1
): Promise<void> {
    const airdropResponse = await rpc
        .requestAirdrop(
            keypair.address,
            lamports(BigInt(solAmount * LAMPORTS_PER_SOL)),
            { commitment: 'confirmed' }
        )
        .send();

    await confirmSignature(rpc, airdropResponse);
}

/**
 * Create the native token mint
 */
async function createMint(
    rpc: any,
    mintKeypair: KeyPairSigner,
    mintAuthority: KeyPairSigner
): Promise<void> {
    const space = BigInt(getMintSize());
    const rent = await rpc.getMinimumBalanceForRentExemption(space).send();

    const createAccountInstruction = getCreateAccountInstruction({
        payer: mintAuthority,
        newAccount: mintKeypair,
        lamports: rent,
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
        rpc,
        [createAccountInstruction, initializeMintInstruction],
        mintAuthority
    );
}

/**
 * Mint tokens to a specific account
 */
async function mintTokensTo(
    rpc: any,
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

    await executeTransaction(rpc, [mintToInstruction], mintAuthority);
}

/**
 * Execute a transaction with the given instructions and signer
 */
async function executeTransaction(
    rpc: any,
    instructions: any[],
    signer: KeyPairSigner
): Promise<string> {
    const latestBlockhashResponse = await rpc.getLatestBlockhash().send();
    const latestBlockhash = latestBlockhashResponse.value;

    const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayerSigner(signer, tx),
        (tx) =>
            setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstructions(instructions, tx)
    );

    const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);

    const sendAndConfirm = sendAndConfirmTransactionFactory({
        rpc,
        rpcSubscriptions: createSolanaRpcSubscriptions('ws://127.0.0.1:8900'),
    });

    await sendAndConfirm(signedTransaction, { commitment: 'confirmed' });

    return 'transaction-executed';
}

/**
 * Confirm a transaction signature
 */
async function confirmSignature(rpc: any, signature: string): Promise<void> {
    while (true) {
        const {
            value: [status],
        } = await rpc.getSignatureStatuses([signature]).send();

        if (status) {
            if (status.err) {
                throw new Error(
                    `Transaction failed: ${JSON.stringify(status.err)}`
                );
            }
            if (
                status.confirmationStatus === 'confirmed' ||
                status.confirmationStatus === 'finalized'
            ) {
                return;
            }
        }

        await new Promise((resolve) => setTimeout(resolve, 500));
    }
}

/**
 * Reset the global test context (useful for testing the setup itself)
 */
export function resetTestContext(): void {
    globalTestContext = null;
    console.log('🔄 Test context reset');
}
