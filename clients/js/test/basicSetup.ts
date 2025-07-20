import test from 'ava';

import { LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as sdk from '../src';
import {
    type Address,
    createSolanaRpc,
    createSolanaRpcSubscriptions,
    pipe,
    KeyPairSigner,
    generateKeyPairSigner,
    lamports,
    createTransactionMessage,
    appendTransactionMessageInstruction,
    setTransactionMessageFeePayer,
    setTransactionMessageLifetimeUsingBlockhash,
    signTransactionMessageWithSigners,
    sendAndConfirmTransactionFactory,
    getSignatureFromTransaction,
} from '@solana/kit';
import {
    findAssociatedTokenPda,
    TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';

 // Setup local connection (assuming local validator is running)
const rpc = createSolanaRpc('http://127.0.0.1:8899');
const rpcSubscriptions = createSolanaRpcSubscriptions("http://127.0.0.1:8899");

// Fund keypairs with SOL for tx fees
async function fundKeypairs(
    authorityKeypair: KeyPairSigner,
    treasuryKeypair: KeyPairSigner,
    teamKeypair: KeyPairSigner,
    userKeypair: KeyPairSigner
) {
    await rpc.requestAirdrop(
        authorityKeypair.address,
        lamports(BigInt(2 * LAMPORTS_PER_SOL))
    ).send();
    await rpc.requestAirdrop(
        treasuryKeypair.address,
        lamports(BigInt(LAMPORTS_PER_SOL))
    ).send();
    await rpc.requestAirdrop(
        teamKeypair.address,
        lamports(BigInt(LAMPORTS_PER_SOL))
    ).send();
    await rpc.requestAirdrop(
        userKeypair.address,
        lamports(BigInt(LAMPORTS_PER_SOL))
    ).send();
    // Confirm balances
    console.log('Funded keypairs');
}

// Example: Initialize admin
async function testInitializeAdmin() {
    // Generate keypairs
    const authorityKeypair: KeyPairSigner = await generateKeyPairSigner();
    const treasuryKeypair: KeyPairSigner = await generateKeyPairSigner();
    const teamKeypair: KeyPairSigner = await generateKeyPairSigner();
    const mintKeypair: KeyPairSigner = await generateKeyPairSigner();
    const mint: Address = mintKeypair.address;
    const userKeypair: KeyPairSigner = await generateKeyPairSigner();

    // Derive PDAs
    const globalAdmin = (await sdk.findGlobalAdminPda())[0];

    // Get ATAs (assuming mint is created; in full test, create mint first)
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

    await fundKeypairs(authorityKeypair, treasuryKeypair, teamKeypair, userKeypair);

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

    // Get recent blockhash
    const latestBlockhashResponse = await rpc.getLatestBlockhash().send();
    const latestBlockhash = latestBlockhashResponse.value;

    // Build transaction using pipe()
    const transactionMessage = pipe(
        // 1. Start with empty transaction message
        createTransactionMessage({ version: 0 }),

        // 2. Add the instruction
        (tx) => appendTransactionMessageInstruction(instruction, tx),

        // 3. Set the fee payer
        (tx) => setTransactionMessageFeePayer(authorityKeypair.address, tx),

        // 4. Set the blockhash for transaction lifetime
        (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx)
    );

    // Sign the transaction
    const signedTransaction =
        await signTransactionMessageWithSigners(transactionMessage);

    // Send and confirm
    const sendAndConfirmTransaction = sendAndConfirmTransactionFactory({rpc, rpcSubscriptions});
    await sendAndConfirmTransaction(signedTransaction,  { commitment: 'confirmed'});
    let signature = getSignatureFromTransaction(signedTransaction);
        

    console.log('Initialize Admin Tx:', signature);

    const admin = await sdk.fetchGlobalAdmin(rpc, globalAdmin);
    console.log('Admin:', JSON.stringify(admin, null, 2));
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
    await testInitializeAdmin();
    t.pass('Initialize admin completed successfully');
});

// test('Create User', async (t) => {
//     await testCreateUser();
//     t.pass('Create user completed successfully');
// });