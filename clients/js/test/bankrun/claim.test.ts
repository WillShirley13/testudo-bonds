import { describe, test, beforeAll } from 'vitest';
import { getBankrunTestContext, type BankrunTestContext } from './setup.js';
import * as sdk from '../../src/index.js';
import { fetchEncodedAccount } from '@solana/kit';

describe('Bond Claim Tests (Bankrun)', () => {
    let testContext: BankrunTestContext;

    beforeAll(async () => {
        testContext = await getBankrunTestContext();
    });

    test('should not allow claiming before maturity', async () => {
        const {
            banksClient,
            user,
            userAta,
            bondPda,
            nativeTokenMint,
            getCurrentTimestamp,
        } = testContext;

        // Verify bond exists and is not mature yet
        const bondAccount = await banksClient.getAccount(bondPda);
        expect(bondAccount).toBeTruthy();

        const currentTime = await getCurrentTimestamp();
        console.log(`Current timestamp: ${currentTime}`);

        // Try to claim before maturity - should fail
        try {
            const claimBondIx = await sdk.getClaimBondInstructionAsync({
                bondAccount: bondPda,
                userWallet: user,
                userTokenAccount: userAta,
                nativeTokenMint,
            });

            await executeTransaction(banksClient, [claimBondIx], user);
            throw new Error('Expected transaction to fail');
        } catch (error) {
            console.log('✅ Claim correctly failed before maturity:', error.message);
            expect(error.message).toContain('BondNotMatured');
        }
    });

    test('should allow claiming after maturity with correct interest', async () => {
        const {
            banksClient,
            user,
            userAta,
            bondPda,
            nativeTokenMint,
            advanceTime,
            getCurrentTimestamp,
        } = testContext;

        // Get initial user token balance
        const userTokenAccountBefore = await banksClient.getAccount(userAta);
        const initialBalance = sdk.fetchMaybeEncodedAccount(userTokenAccountBefore)?.data?.amount || 0n;
        
        console.log(`Initial user balance: ${initialBalance}`);

        // Get bond data before claiming
        const bondAccountBefore = await banksClient.getAccount(bondPda);
        const bondDataBefore = sdk.fetchMaybeBondAccount(bondAccountBefore);
        expect(bondDataBefore).toBeTruthy();
        
        const depositAmount = bondDataBefore!.data.depositAmount;
        const interestRate = bondDataBefore!.data.interestRate;
        
        console.log(`Bond deposit: ${depositAmount}, interest rate: ${interestRate}bp`);

        // Fast forward time by 31 days (beyond the 30-day maturity)
        const timeToAdvance = BigInt(31 * 24 * 60 * 60); // 31 days in seconds
        console.log(`Advancing time by ${timeToAdvance} seconds...`);
        
        await advanceTime(timeToAdvance);
        
        const newTimestamp = await getCurrentTimestamp();
        console.log(`New timestamp: ${newTimestamp}`);

        // Now claim the bond - should succeed
        const claimBondIx = await sdk.getClaimBondInstructionAsync({
            bondAccount: bondPda,
            userWallet: user,
            userTokenAccount: userAta,
            nativeTokenMint,
        });

        await executeTransaction(banksClient, [claimBondIx], user);
        console.log('✅ Bond claimed successfully after maturity');

        // Verify the bond account is closed/updated
        const bondAccountAfter = await banksClient.getAccount(bondPda);
        const bondDataAfter = sdk.fetchMaybeBondAccount(bondAccountAfter);
        
        if (bondDataAfter) {
            // If bond account still exists, verify it's been updated
            expect(bondDataAfter.data.totalClaimed).toBeGreaterThan(0n);
            expect(bondDataAfter.data.isActive).toBe(false);
            console.log(`Bond updated - claimed: ${bondDataAfter.data.totalClaimed}, active: ${bondDataAfter.data.isActive}`);
        } else {
            console.log('Bond account closed after claim');
        }

        // Verify user received tokens (principal + interest)
        const userTokenAccountAfter = await banksClient.getAccount(userAta);
        const finalBalance = sdk.fetchMaybeEncodedAccount(userTokenAccountAfter)?.data?.amount || 0n;
        
        console.log(`Final user balance: ${finalBalance}`);
        
        // Calculate expected interest (5% of deposit amount)
        const expectedInterest = (depositAmount * BigInt(interestRate)) / 10000n;
        const expectedTotal = depositAmount + expectedInterest;
        
        console.log(`Expected interest: ${expectedInterest}`);
        console.log(`Expected total: ${expectedTotal}`);
        
        // User should have received back their deposit + interest
        const balanceIncrease = finalBalance - initialBalance;
        expect(balanceIncrease).toBe(expectedTotal);
        
        console.log(`✅ User correctly received ${balanceIncrease} tokens (${depositAmount} principal + ${expectedInterest} interest)`);
    });

    test('should prevent double claiming', async () => {
        const {
            banksClient,
            user,
            userAta,
            bondPda,
            nativeTokenMint,
        } = testContext;

        // Try to claim again - should fail
        try {
            const claimBondIx = await sdk.getClaimBondInstructionAsync({
                bondAccount: bondPda,
                userWallet: user,
                userTokenAccount: userAta,
                nativeTokenMint,
            });

            await executeTransaction(banksClient, [claimBondIx], user);
            throw new Error('Expected transaction to fail');
        } catch (error) {
            console.log('✅ Double claim correctly prevented:', error.message);
            expect(error.message).toMatch(/BondAlreadyClaimed|BondNotActive|AccountNotFound/);
        }
    });
});

/**
 * Helper function to execute transactions in Bankrun context
 */
async function executeTransaction(
    banksClient: any,
    instructions: any[],
    signer: any
): Promise<void> {
    const { pipe, createTransactionMessage, setTransactionMessageFeePayerSigner, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstructions, signTransactionMessageWithSigners } = await import('@solana/kit');
    
    const latestBlockhash = await banksClient.getLatestBlockhash();

    const transactionMessage = pipe(
        createTransactionMessage({ version: 0 }),
        (tx: any) => setTransactionMessageFeePayerSigner(signer, tx),
        (tx: any) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, tx),
        (tx: any) => appendTransactionMessageInstructions(instructions, tx)
    );

    const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
    await banksClient.processTransaction(signedTransaction);
}