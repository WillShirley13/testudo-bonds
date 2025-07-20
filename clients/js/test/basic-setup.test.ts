import test from 'ava';

import * as sdk from '../src/index.js';
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
    getSignatureFromTransaction,
    setTransactionMessageFeePayerSigner,
} from '@solana/kit';
import {
    findAssociatedTokenPda,
    TOKEN_PROGRAM_ADDRESS,
    getInitializeMintInstruction,
    getMintSize,
} from '@solana-program/token';
import { getCreateAccountInstruction } from '@solana-program/system';

const LAMPORTS_PER_SOL = 1_000_000_000;


async function getRpcs() {
    // Setup local connection (assuming local validator is running)
    const rpc = createSolanaRpc('http://127.0.0.1:8899');
    const rpcSubscriptions = createSolanaRpcSubscriptions('ws://127.0.0.1:8900');
    return { rpc, rpcSubscriptions };
}

// Fund keypairs with SOL for tx fees
async function fundKeypairs(
    authorityKeypair: KeyPairSigner,
    treasuryKeypair: KeyPairSigner,
    teamKeypair: KeyPairSigner,
    userKeypair: KeyPairSigner
) {
    const { rpc } = await getRpcs();
    const airdropResponse = await rpc
        .requestAirdrop(
            authorityKeypair.address,
            lamports(BigInt(2 * LAMPORTS_PER_SOL)),
            { commitment: "confirmed"}
        )
        .send();
    const airdropResponse2 = await rpc
        .requestAirdrop(
            treasuryKeypair.address,
            lamports(BigInt(LAMPORTS_PER_SOL)),
            { commitment: "confirmed"}
        )
        .send();
    const airdropResponse3 = await rpc
        .requestAirdrop(teamKeypair.address, lamports(BigInt(LAMPORTS_PER_SOL)), { commitment: "confirmed"})
        .send();
    const airdropResponse4 = await rpc
        .requestAirdrop(userKeypair.address, lamports(BigInt(LAMPORTS_PER_SOL)), { commitment: "confirmed"})
        .send();
    
    // confirm all airdrops in parallel
    await Promise.all([
        confirmSignature(rpc, airdropResponse),
        confirmSignature(rpc, airdropResponse2), 
        confirmSignature(rpc, airdropResponse3),
        confirmSignature(rpc, airdropResponse4)
    ]);

    console.log('Funded keypairs');
}

async function confirmSignature(rpc: any, signature: string) {
    while (true) {
        const { value: [status] } = await rpc.getSignatureStatuses([signature]).send();
        
        if (status) {
            if (status.err) {
                throw new Error(`Transaction failed: ${JSON.stringify(status.err)}`);
            }
            if (status.confirmationStatus === 'confirmed' || status.confirmationStatus === 'finalized') {
                return; // confirmed!
            }
        }
        
        await new Promise(resolve => setTimeout(resolve, 500)); // wait 500ms
    }
}

// Example: Initialize admin
async function testInitializeAdmin() {
    const { rpc, rpcSubscriptions } = await getRpcs();
    // Generate keypairs
    const authorityKeypair: KeyPairSigner = await generateKeyPairSigner();
    const treasuryKeypair: KeyPairSigner = await generateKeyPairSigner();
    const teamKeypair: KeyPairSigner = await generateKeyPairSigner();
    const mintKeypair: KeyPairSigner = await generateKeyPairSigner();
    const mint: Address = mintKeypair.address;
    const userKeypair: KeyPairSigner = await generateKeyPairSigner();

    // Fund keypairs first
    await fundKeypairs(
        authorityKeypair,
        treasuryKeypair,
        teamKeypair,
        userKeypair
    );


    // Create the mint
    const space = BigInt(getMintSize());
    const rent = await rpc.getMinimumBalanceForRentExemption(space).send();

    const createAccountInstruction = getCreateAccountInstruction({
        payer: authorityKeypair,
        newAccount: mintKeypair,
        lamports: rent,
        space,
        programAddress: TOKEN_PROGRAM_ADDRESS
    });

    const initializeMintInstruction = getInitializeMintInstruction({
        mint: mint,
        decimals: 9,
        mintAuthority: authorityKeypair.address,
        freezeAuthority: authorityKeypair.address
    });

    // Build and send create mint tx
    const latestBlockhashResponse = await rpc.getLatestBlockhash().send();
    const latestBlockhash = latestBlockhashResponse.value;

    const createMintTxMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx) => setTransactionMessageFeePayerSigner(authorityKeypair, tx),
        (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx) => appendTransactionMessageInstructions([createAccountInstruction, initializeMintInstruction], tx),
    );

    const signedCreateMintTx = await signTransactionMessageWithSigners(createMintTxMessage);
    const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
    try {
        await sendAndConfirm(signedCreateMintTx, { commitment: 'confirmed' });
    } catch (error) {
        console.error('Error creating mint:', error);
    }
    console.log('Mint created:', mint);

    // Derive PDAs
    const globalAdmin = (await sdk.findGlobalAdminPda())[0];
    console.log('Global admin:', globalAdmin);

    // // Create ATAs
    // const createRewardsPoolAta = await getCreateAssociatedTokenInstructionAsync({
    //     payer: authorityKeypair,
    //     mint: mint,
    //     owner: globalAdmin
    // });

    // const createTreasuryAta = await getCreateAssociatedTokenInstructionAsync({
    //     payer: authorityKeypair,
    //     mint: mint,
    //     owner: treasuryKeypair.address
    // });

    // const createTeamAta = await getCreateAssociatedTokenInstructionAsync({
    //     payer: authorityKeypair,
    //     mint: mint,
    //     owner: teamKeypair.address
    // });

    // Build and send create ATAs tx
    // const createAtasTxMessage = pipe(
    //     createTransactionMessage({ version: 0 }),
    //     (tx) => appendTransactionMessageInstruction(createRewardsPoolAta, tx),
    //     (tx) => appendTransactionMessageInstruction(createTreasuryAta, tx),
    //     (tx) => appendTransactionMessageInstruction(createTeamAta, tx),
    //     (tx) => setTransactionMessageFeePayer(authorityKeypair.address, tx),
    //     (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx)
    // );

    // const signedCreateAtasTx = await signTransactionMessageWithSigners(
    //     createAtasTxMessage,
    //     [authorityKeypair],
    // );
    // await sendAndConfirm(signedCreateAtasTx, { commitment: 'confirmed' });
    // console.log('ATAs created');

    // Get ATAs
    const [rewardsPoolAta] = await findAssociatedTokenPda({
        owner: globalAdmin,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        mint: mint,
    });
    const [treasuryAta] = await findAssociatedTokenPda({
        owner: treasuryKeypair.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        mint: mint,
    });
    const [teamAta] = await findAssociatedTokenPda({
        owner: teamKeypair.address,
        tokenProgram: TOKEN_PROGRAM_ADDRESS,
        mint: mint,
    });

    // Create the instruction
    const instruction = await sdk.getInitializeAdminInstructionAsync({
        authority: authorityKeypair,
        rewardsPoolAta: rewardsPoolAta,
        treasury: treasuryKeypair.address,
        treasuryAta: treasuryAta,
        team: teamKeypair.address,
        teamAta: teamAta,
        nativeTokenMint: mint,
        associatedTokenProgram:
            'ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL' as Address,
    });
    console.log('Instruction:', instruction);

    // Get recent blockhash
    const latestBlockhashResponse2 = await rpc.getLatestBlockhash().send();
    const latestBlockhash2 = latestBlockhashResponse2.value;

    // Build transaction using pipe()
    const transactionMessage = pipe(
        // 1. Start with empty transaction message
        createTransactionMessage({ version: 0 }),

        // 2. Add the instruction
        (tx) => appendTransactionMessageInstructions([instruction], tx),

        // 3. Set the fee payer
        (tx) => setTransactionMessageFeePayer(authorityKeypair.address, tx),

        // 4. Set the blockhash for transaction lifetime
        (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash2, tx)
    );

    // Sign the transaction
    const signedTransaction = await signTransactionMessageWithSigners(
        transactionMessage
    );

    // Send and confirm
    const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({
        rpc,
        rpcSubscriptions,
    });
    await sendAndConfirmTransaction(signedTransaction, {
        commitment: 'confirmed',
    });
    let signature = getSignatureFromTransaction(signedTransaction);

    console.log('Initialize Admin Tx:', signature);

    const admin = await sdk.fetchGlobalAdmin(rpc, globalAdmin);
    console.log('Admin:', admin);
}

// Example: Create user
// async function testCreateUser() {
// await fundKeypairs();

// // Create the instruction
// const instruction = await sdk.getCreateUserInstructionAsync({
//     userWallet: userKeypair.address,
// });

// // Get recent blockhash
// const latestBlockhashResponse = await rpc.getLatestBlockhash().send();
// const latestBlockhash = latestBlockhashResponse.value;

// // Build transaction using pipe()
// const transactionMessage = pipe(
//     // 1. Start with empty transaction message
//     createTransactionMessage({ version: 0 }),

//     // 2. Add the instruction
//     (tx) => appendTransactionMessageInstruction(instruction, tx),

//     // 3. Set the fee payer
//     (tx) => setTransactionMessageFeePayer(userKeypair.address, tx),

//     // 4. Set the blockhash for transaction lifetime
//     (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx)
// );

// // Sign the transaction
// const signedTransaction =
//     await signTransactionMessageWithSigners(transactionMessage);

// // Send and confirm
// const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({ rpc, });
// const signature = await sendAndConfirmTransaction(signedTransaction, {
//     commitment: 'confirmed',
// });

// console.log('Create User Tx:', signature);
// }

// Run tests using AVA
test('Initialize Admin', async (t) => {
    console.log('------------Initializing admin------------');
    try {
        await testInitializeAdmin();
        t.pass('Initialize admin completed successfully');
    } catch (error) {
        console.error('Test failed:', error);
        t.fail(`Test failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
});

// test('Create User', async (t) => {
//     await testCreateUser();
//     t.pass('Create user completed successfully');
// });

// Simple test that doesn't require validator connection
test('Basic SDK import test', (t) => {
    t.truthy(sdk, 'SDK is imported successfully');
});
