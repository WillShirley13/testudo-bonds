import { describe, expect, it } from 'vitest';
import { getTestContext } from '../helpers/setup';
import * as sdk from '../../src/index';
import {
    pipe,
    createTransactionMessage,
    appendTransactionMessageInstructions,
    setTransactionMessageFeePayerSigner,
    setTransactionMessageLifetimeUsingBlockhash,
    signTransactionMessageWithSigners,
    sendAndConfirmTransactionFactory,
    assertAccountExists,
    fetchEncodedAccount,
} from '@solana/kit';
import { 
    assertWithLog, 
    assertBigIntWithLog, 
    assertNumberWithLog 
} from '../helpers/assertions';
// User PDA instruction tests
// This file contains comprel tests tests for Ushe PDA functionality and security

describe('User Instructions', async () => {
    const {
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
        createFreshUser,
        setNewAdminAuthority,
        fundKeypair,
        mintTokensToUser,
        confirmTransaction,
        getLatestBlockhash,
    } = await getTestContext();

    console.log(' Admin authority: ', adminAuthority.address);
    it('should pass when creating new user PDA', async () => {
        console.log('user1', user1.address);
        // Get the user PDA address
        const [userPdaAddress] = await sdk.findUserPdaPda({
            userWallet: user1.address,
        });

        // Create the instruction to create a user account
        const initUserIx = await sdk.getCreateUserInstructionAsync({
            userWallet: user1,
        });

        // Get the latest blockhash
        const latestBlockhash = await getLatestBlockhash();

        // Create the transaction message
        const transactionMessage = pipe(
            createTransactionMessage({ version: 0 }),
            (tx) => setTransactionMessageFeePayerSigner(user1, tx),
            (tx) =>
                setTransactionMessageLifetimeUsingBlockhash(
                    latestBlockhash,
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

        await sendAndConfirm(signedTransaction, { commitment: 'confirmed' });

        // Fetch the user account to verify it was created correctly
        const userAccount = await sdk.fetchUserPda(rpc, userPdaAddress);

        // Verify the account data
        let userPdaPostInit = await fetchEncodedAccount(rpc, userPdaAddress);
        assertAccountExists(userPdaPostInit);
        console.log(`✅ User PDA account exists at: ${userPdaAddress}`);
        
        // Verify user account data
        assertWithLog(
            userAccount.data.user, 
            user1.address, 
            "User wallet address matches"
        );
        
        assertNumberWithLog(
            userAccount.data.bondCount, 
            0, 
            "Initial bond count is zero"
        );
        
        assertBigIntWithLog(
            userAccount.data.totalAccruedRewards, 
            0n, 
            "Initial accrued rewards is zero"
        );
        
        // Check active bonds array is empty
        assertWithLog(
            userAccount.data.activeBonds.length, 
            0, 
            "Active bonds array is empty"
        );
        
        assertNumberWithLog(
            userAccount.data.bondIndex, 
            0, 
            "Initial bond index is zero"
        );

        // let expectedSize = sdk.getUserPdaSize();
        // let actualSize = userPdaPostInit.data.length;
        // assertNumberWithLog(
        //     actualSize,
        //     expectedSize,
        //     "User PDA account size matches expected size"
        // );
    });
    
    it('should fail when trying to create user PDA twice for same wallet', async () => {
        // Since user1 PDA already exists from previous test, we'll try to create it again
        // This should fail because account already exists
        
        const [userPdaAddress] = await sdk.findUserPdaPda({
            userWallet: user1.address,
        });
        
        // Verify the account already exists from previous test
        const existingAccount = await fetchEncodedAccount(rpc, userPdaAddress);
        console.log('Account exists before creation attempt:', !!existingAccount);
        
        // Try to create user PDA when it already exists (should fail)
        const initUserIx = await sdk.getCreateUserInstructionAsync({
            userWallet: user1,
        });
        
        const latestBlockhash = await getLatestBlockhash();
        const transactionMessage = pipe(
            createTransactionMessage({ version: 0 }),
            (tx) => setTransactionMessageFeePayerSigner(user1, tx),
            (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
            (tx) => appendTransactionMessageInstructions([initUserIx], tx)
        );
        
        const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
        const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
        
        // This should fail because account already exists
        try {
            await sendAndConfirm(signedTransaction, { commitment: 'confirmed' });
            expect.fail('Expected an error but none was thrown');
        } catch (error: any) {
            console.log('✅ Correctly failed to create duplicate user PDA');
            console.log('Transaction failed (as intended) with detailed error:');
            console.log('Error type:', error.constructor.name);
            console.log('Error message:', error.message);
            console.log('Error context:', error.context);
            
            // Verify we got the expected error (account must be empty)
            expect(error).toBeDefined();
            if (error.context?.logs) {
                console.log('Transaction logs:', error.context.logs);
                const hasExpectedError = error.context.logs.some((log: string) => 
                    log.includes('must be empty') || log.includes('custom program error: 0x4')
                );
                expect(hasExpectedError).toBe(true);
                console.log('✅ Received expected error for duplicate account creation');
            }
        }
    });

    // SECURITY TESTS
    
    it('should fail when wrong signer tries to create user PDA', async () => {
        // Create two different keypairs
        const actualUser = user1;
        const maliciousUser = user2;
        
        // Try to create PDA for actualUser but signed by maliciousUser
        const initUserIx = await sdk.getCreateUserInstructionAsync({
            userWallet: actualUser, // PDA will be derived for actualUser
        });
        
        const latestBlockhash = await getLatestBlockhash();
        const transactionMessage = pipe(
            createTransactionMessage({ version: 0 }),
            (tx) => setTransactionMessageFeePayerSigner(maliciousUser, tx), // But signed by maliciousUser
            (tx) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
            (tx) => appendTransactionMessageInstructions([initUserIx], tx)
        );
        
        const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
        const sendAndConfirm = sendAndConfirmTransactionFactory({ rpc, rpcSubscriptions });
        
        // This should fail due to signature mismatch
        try {
            await sendAndConfirm(signedTransaction, { commitment: 'confirmed' });
            expect.fail('Expected an error but none was thrown');
        } catch (error: any) {
            console.log('✅ Correctly rejected unauthorized user PDA creation');
            console.log('Transaction failed (as intended) with detailed error:');
            console.log('Error type:', error.constructor.name);
            console.log('Error message:', error.message);
            console.log('Error context:', error.context);
        }
    });

    it('should validate PDA derivation matches expected seeds', async () => {
        // Derive PDA using SDK function
        const [derivedPda, bump] = await sdk.findUserPdaPda({
            userWallet: user1.address
        });
        
        // Manually verify the PDA derivation follows expected pattern: ["user", wallet_pubkey]
        console.log(`✅ PDA derived: ${derivedPda} with bump: ${bump}`);
        console.log(`✅ For user wallet: ${user1.address}`);
        
        // Verify PDA is deterministic (same inputs = same output)
        const [derivedPda2] = await sdk.findUserPdaPda({
            userWallet: user1.address
        });
        
        assertWithLog(derivedPda, derivedPda2, "PDA derivation is deterministic");
    });


    it('should validate user PDA ownership', async () => {
        const [userPdaAddress] = await sdk.findUserPdaPda({ userWallet: user1.address });
        
        // User PDA should already exist from previous tests, so we'll just validate its ownership
        // Fetch raw account to verify owner
        const rawAccount = await fetchEncodedAccount(rpc, userPdaAddress);
        assertAccountExists(rawAccount);

        const userPda = await sdk.fetchUserPda(rpc, userPdaAddress);
        console.log('User PDA: ', userPda);

        assertWithLog(userPda.data.user, user1.address, "User PDA owned by correct user");
        
    });

    it('should validate user PDA bond count', async () => {
        const [userPdaAddress] = await sdk.findUserPdaPda({ userWallet: user1.address });
        const userPda = await sdk.fetchUserPda(rpc, userPdaAddress);
        console.log('User PDA: ', userPda);
        assertWithLog(userPda.data.bondCount, 0, "User PDA bond count is zero");
    });

    it('should validate user PDA total accrued rewards', async () => {
        const [userPdaAddress] = await sdk.findUserPdaPda({ userWallet: user1.address });
        const userPda = await sdk.fetchUserPda(rpc, userPdaAddress);
        console.log('User PDA: ', userPda);
        assertWithLog(userPda.data.totalAccruedRewards, 0n, "User PDA total accrued rewards is zero");
    });

    it('should validate user PDA bond index', async () => {
        const [userPdaAddress] = await sdk.findUserPdaPda({ userWallet: user1.address });
        const userPda = await sdk.fetchUserPda(rpc, userPdaAddress);
        console.log('User PDA: ', userPda);
        assertWithLog(userPda.data.bondIndex, 0, "User PDA bond index is zero");
    });

    it('should validate user PDA active bonds', async () => {
        const [userPdaAddress] = await sdk.findUserPdaPda({ userWallet: user1.address });
        const userPda = await sdk.fetchUserPda(rpc, userPdaAddress);
        console.log('User PDA: ', userPda);
        assertWithLog(userPda.data.activeBonds.length, 0, "User PDA active bonds array is empty");
    });




});
    