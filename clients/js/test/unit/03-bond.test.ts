import { describe, it } from 'vitest';
import { getTestContext, SHELLS_PER_TESTUDO } from '../helpers/setup';
import {
    KeyPairSigner,
    Address,
    pipe,
    createTransactionMessage,
    setTransactionMessageFeePayer,
    setTransactionMessageLifetimeUsingBlockhash,
    appendTransactionMessageInstruction,
    signTransactionMessageWithSigners,
    sendAndConfirmTransactionFactory,
    fetchEncodedAccount,
    assertAccountExists,
} from '@solana/kit';
import {
    ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
    findAssociatedTokenPda,
    TOKEN_PROGRAM_ADDRESS,
} from '@solana-program/token';
import * as sdk from '../../src/index';
import { assertWithLog } from '../helpers/assertions';
import { start, Clock, BanksClient, ProgramTestContext } from 'solana-bankrun';
// InitializeBond instruction tests
// This file will contain all tests related to the InitializeBond instruction

describe('Bond Instructions', async () => {
    const {
        rpc,
        rpcSubscriptions,
        adminAuthority,
        nativeTokenMint,
        globalAdminPda,
        rewardsPoolAta,
        treasuryAta,
        teamAta,
        user1,
        mintTokensToUser,
        createAta,
    } = await getTestContext();
    console.log(' Admin authority: ', adminAuthority.address);


    it('should initialize a bond', async () => {
        const user: KeyPairSigner = user1;
        console.log('user', user.address);
        const [userPda] = await sdk.findUserPdaPda({
            userWallet: user.address,
        });
        console.log('userPda', userPda);
        //confirm userPda exists
        let userPdaAccount = await fetchEncodedAccount(rpc, userPda);
        assertAccountExists(userPdaAccount);
        console.log('userPdaAccount exists: ', userPdaAccount.exists);

        let userPdaAccountData = sdk
            .getUserPdaCodec()
            .decode(userPdaAccount.data);
        let newBondIndex = userPdaAccountData.bondIndex;
        let [bondPda] = await sdk.findBondPda({
            userPda: userPda,
            bondIndex: newBondIndex,
        });

        // Create (or fetch) the user’s associated token account via the shared helper
        const userWalletAta: Address = await createAta(user);

        console.log('Minting tokens to user');
        await mintTokensToUser(user, BigInt(10 * SHELLS_PER_TESTUDO));
        let userTokenBalance = await rpc
            .getTokenAccountBalance(userWalletAta)
            .send();
        console.log('userTokenBalance', userTokenBalance.value.amount);

        // Confirm existance of rewardsPoolAta, treasuryAta, teamAta
        let rewardsPoolAtaAccount = await fetchEncodedAccount(
            rpc,
            rewardsPoolAta
        );
        assertAccountExists(rewardsPoolAtaAccount);
        console.log(`rewardsPoolAta exists: ${rewardsPoolAtaAccount.exists}`);
        let treasuryAtaAccount = await fetchEncodedAccount(rpc, treasuryAta);
        assertAccountExists(treasuryAtaAccount);
        console.log(`treasuryAta exists: ${treasuryAtaAccount.exists}`);
        let teamAtaAccount = await fetchEncodedAccount(rpc, teamAta);
        assertAccountExists(teamAtaAccount);
        console.log(`teamAta exists: ${teamAtaAccount.exists}`);

        let initBondIx = await sdk.getInitializeBondInstructionAsync({
            bond: bondPda,
            userWallet: user,
            userPda: userPda, // Explicitly pass userPda
            globalAdmin: globalAdminPda, // Add missing global admin
            userWalletAta: userWalletAta,
            rewardsPoolAta: rewardsPoolAta,
            treasuryAta: treasuryAta,
            teamAta: teamAta,
            nativeTokenMint: nativeTokenMint,
        });

        let recentBlockhash = (await rpc.getLatestBlockhash().send()).value;

        console.log('Invoking initialize bond instruction');

        let transactionMsg = pipe(
            createTransactionMessage({ version: 0 }),
            (tx) => setTransactionMessageFeePayer(user.address, tx),
            (tx) =>
                setTransactionMessageLifetimeUsingBlockhash(
                    recentBlockhash,
                    tx
                ),
            (tx) => appendTransactionMessageInstruction(initBondIx, tx)
        );

        let transactionSig2 =
            await signTransactionMessageWithSigners(transactionMsg);

        const sendAndConfirm = sendAndConfirmTransactionFactory({
            rpc,
            rpcSubscriptions,
        });

        try {
            await sendAndConfirm(transactionSig2, {
                commitment: 'confirmed',
            });
        } catch (error: any) {
            console.log('\n=== TRANSACTION ERROR DETAILS ===');
            console.log('Error type:', error.constructor.name);
            console.log('Error message:', error.message);

            // Print the detailed error context if available
            if (error.context) {
                console.log('Error code:', error.context.__code);
                console.log(
                    'Compute units consumed:',
                    error.context.unitsConsumed?.toString()
                );

                if (error.context.logs) {
                    console.log('\n=== PROGRAM LOGS ===');
                    error.context.logs.forEach((log: string, index: number) => {
                        console.log(`${index + 1}: ${log}`);
                    });
                }
            }

            // Print the underlying cause if available
            if (error.cause) {
                console.log('\nUnderlying cause:', error.cause.message);
            }
            // Re-throw the error so the test still fails
            throw error;
        }

        let bondPdaAccount = await fetchEncodedAccount(rpc, bondPda);
        assertAccountExists(bondPdaAccount);

        let bondData = await sdk.getBondCodec().decode(bondPdaAccount.data);

        assertWithLog(bondData.owner, userPda, 'Bond owner should be the user');
        assertWithLog(
            bondData.bondIndex,
            newBondIndex,
            'Bond index should be the new bond index'
        );
        assertWithLog(
            bondData.lastClaimTimestamp,
            bondData.creationTimestamp,
            'Upon creation, last claim and creation timestamps should be the same'
        );
        assertWithLog(
            bondData.totalClaimed,
            0n,
            'Bond total claimed should be 0'
        );
        assertWithLog(bondData.isActive, true, 'Bond should be active');

        // ADVANCE TIME BY 30 DAYS
        const context = await start([], []);  // Start bankrun context
        const currentClock = await context.banksClient.getClock();
        
        console.log('=== TIME TRAVEL TEST ===');
        console.log('Before time travel:');
        console.log('  Unix timestamp:', currentClock.unixTimestamp.toString());
        console.log('  Human readable:', new Date(Number(currentClock.unixTimestamp) * 1000).toISOString());
        console.log('  Slot:', currentClock.slot.toString());
        
        // Fast forward 30 days (2,592,000 seconds)
        const newClock = new Clock(
            currentClock.slot,
            currentClock.epochStartTimestamp,
            currentClock.epoch,
            currentClock.leaderScheduleEpoch,
            currentClock.unixTimestamp + 2_592_000n  // +30 days
        );
        
        context.setClock(newClock);
        
        // Verify the time change
        const updatedClock = await context.banksClient.getClock();
        console.log('After time travel (+30 days):');
        console.log('  Unix timestamp:', updatedClock.unixTimestamp.toString());
        console.log('  Human readable:', new Date(Number(updatedClock.unixTimestamp) * 1000).toISOString());
        console.log('  Slot:', updatedClock.slot.toString());
        console.log('  Time difference (seconds):', (updatedClock.unixTimestamp - currentClock.unixTimestamp).toString());
        console.log('  Time difference (days):', Number(updatedClock.unixTimestamp - currentClock.unixTimestamp) / 86400);
        
        // Fetch and display bond data with calculated rewards
        let bondPdaAccountAfter = await fetchEncodedAccount(rpc, bondPda);
        assertAccountExists(bondPdaAccountAfter);
        let bondDataAfter = await sdk.getBondCodec().decode(bondPdaAccountAfter.data);
        
        // Fetch admin data to get daily_emission_rate and other parameters
        let globalAdminAccount = await fetchEncodedAccount(rpc, globalAdminPda);
        assertAccountExists(globalAdminAccount);
        let adminData = await sdk.getGlobalAdminCodec().decode(globalAdminAccount.data);
        
        console.log('\n=== BOND REWARD CALCULATION ===');
        console.log('Bond data:');
        console.log('  Creation timestamp:', bondDataAfter.creationTimestamp.toString());
        console.log('  Last claim timestamp:', bondDataAfter.lastClaimTimestamp.toString());
        console.log('  Total claimed so far:', bondDataAfter.totalClaimed.toString());
        console.log('  Is active:', bondDataAfter.isActive);
        
        console.log('\nAdmin data:');
        console.log('  Daily emission rate:', adminData.dailyEmissionRate.toString());
        console.log('  Max emission per bond:', adminData.maxEmissionPerBond.toString());
        console.log('  Claim penalty (basis points):', adminData.claimPenalty.toString());
        
        // Calculate accrued rewards using the same logic as the program
        const currentTimestamp = Number(updatedClock.unixTimestamp);
        const lastClaimTimestamp = Number(bondDataAfter.lastClaimTimestamp);
        const secondsElapsed = currentTimestamp - lastClaimTimestamp;
        const secondsPerDay = 86400;
        
        // Basic reward calculation: (daily_emission * seconds_elapsed) / seconds_per_day
        const basicReward = (Number(adminData.dailyEmissionRate) * secondsElapsed) / secondsPerDay;
        
        // Apply claim penalty if claiming within 5 days
        let rewardWithPenalty = basicReward;
        
        console.log('\nReward calculation:');
        console.log('  Seconds elapsed since last claim:', secondsElapsed);
        console.log('  Days elapsed:', (secondsElapsed / secondsPerDay).toFixed(2));
        console.log('  Basic reward (before penalty):', basicReward.toFixed(0));
        console.log('  Claim penalty applied:', secondsElapsed < secondsPerDay * 5 ? 'Yes' : 'No');
        console.log('  Final accrued reward:', Math.floor(rewardWithPenalty).toString());
        console.log('  Reward in tokens (9 decimals):', (Math.floor(rewardWithPenalty) / 1_000_000_000).toFixed(9));
        console.log('================================');
    });

    it('should successfully claim rewards after time travel', async () => {
        const user: KeyPairSigner = user1;
        console.log('user', user.address);
        
        // Get existing user PDA and bond PDA (should already exist from previous test)
        const [userPda] = await sdk.findUserPdaPda({
            userWallet: user.address,
        });
        
        let userPdaAccount = await fetchEncodedAccount(rpc, userPda);
        assertAccountExists(userPdaAccount);
        let userPdaAccountData = sdk.getUserPdaCodec().decode(userPdaAccount.data);
        
        // Get the bond index from the previous test (should be 0 for first bond)
        const bondIndex = userPdaAccountData.bondIndex - 1; // Previous test incremented it
        const [bondPda] = await sdk.findBondPda({
            userPda: userPda,
            bondIndex: bondIndex,
        });

        // Get user's existing ATA address (created in previous test)
        const [userWalletAta] = await findAssociatedTokenPda({
            owner: user.address,
            tokenProgram: TOKEN_PROGRAM_ADDRESS,
            mint: nativeTokenMint,
        });

        // Get user's token balance before claim
        let userTokenBalanceBefore = await rpc
            .getTokenAccountBalance(userWalletAta)
            .send();
        console.log('User token balance before claim:', userTokenBalanceBefore.value.amount);

        // Get bond data before claim
        let bondPdaAccountBefore = await fetchEncodedAccount(rpc, bondPda);
        assertAccountExists(bondPdaAccountBefore);
        let bondDataBefore = await sdk.getBondCodec().decode(bondPdaAccountBefore.data);
        console.log('Total claimed before:', bondDataBefore.totalClaimed.toString());

        // Create the process claim instruction
        const processClaimIx = await sdk.getProcessClaimInstructionAsync({
            bond: bondPda,
            userWallet: user,
            userPda: userPda,
            userWalletAta: userWalletAta,
            globalAdmin: globalAdminPda,
            rewardsPoolAta: rewardsPoolAta,
            treasuryAta: treasuryAta,
            teamAta: teamAta,
            nativeTokenMint: nativeTokenMint,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ADDRESS,
            bondIndex: bondIndex,
            autoCompound: false, // Set to false to transfer tokens to user's wallet
        });

        let { value: recentBlockhash } = await rpc.getLatestBlockhash().send();

        let transactionMsg = pipe(
            createTransactionMessage({ version: 0 }),
            (tx) => setTransactionMessageFeePayer(user.address, tx),
            (tx) =>
                setTransactionMessageLifetimeUsingBlockhash(
                    recentBlockhash,
                    tx
                ),
            (tx) => appendTransactionMessageInstruction(processClaimIx, tx)
        );

        let transactionSig = await signTransactionMessageWithSigners(transactionMsg);

        const sendAndConfirm = sendAndConfirmTransactionFactory({
            rpc,
            rpcSubscriptions,
        });

        try {
            await sendAndConfirm(transactionSig, {
                commitment: 'confirmed',
            });
            console.log('✅ Claim rewards transaction successful');
        } catch (error: any) {
            console.log('\n=== CLAIM TRANSACTION ERROR DETAILS ===');
            console.log('Error type:', error.constructor.name);
            console.log('Error message:', error.message);

            if (error.context) {
                console.log('Error code:', error.context.__code);
                console.log(
                    'Compute units consumed:',
                    error.context.unitsConsumed?.toString()
                );

                if (error.context.logs) {
                    console.log('\n=== PROGRAM LOGS ===');
                    error.context.logs.forEach((log: string, index: number) => {
                        console.log(`${index + 1}: ${log}`);
                    });
                }
            }

            if (error.cause) {
                console.log('\nUnderlying cause:', error.cause.message);
            }
            throw error;
        }

        // Verify the claim was successful
        let bondPdaAccountAfter = await fetchEncodedAccount(rpc, bondPda);
        assertAccountExists(bondPdaAccountAfter);
        let bondDataAfter = await sdk.getBondCodec().decode(bondPdaAccountAfter.data);

        let userTokenBalanceAfter = await rpc
            .getTokenAccountBalance(userWalletAta)
            .send();

        console.log('\n=== CLAIM VERIFICATION ===');
        console.log('Total claimed before:', bondDataBefore.totalClaimed.toString());
        console.log('Total claimed after:', bondDataAfter.totalClaimed.toString());
        console.log('User token balance before:', userTokenBalanceBefore.value.amount);
        console.log('User token balance after:', userTokenBalanceAfter.value.amount);

        const claimedAmount = bondDataAfter.totalClaimed - bondDataBefore.totalClaimed;
        const tokenBalanceIncrease = BigInt(userTokenBalanceAfter.value.amount) - BigInt(userTokenBalanceBefore.value.amount);

        console.log('Claimed amount:', claimedAmount.toString());
        console.log('Token balance increase:', tokenBalanceIncrease.toString());
        console.log('================================');

        // Assertions
        assertWithLog(
            bondDataAfter.totalClaimed > bondDataBefore.totalClaimed,
            true,
            'Total claimed should have increased'
        );
        
        assertWithLog(
            tokenBalanceIncrease > 0n,
            true,
            'User token balance should have increased'
        );

        assertWithLog(
            tokenBalanceIncrease,
            claimedAmount,
            'Token balance increase should match claimed amount'
        );

        assertWithLog(
            bondDataAfter.lastClaimTimestamp > bondDataBefore.lastClaimTimestamp,
            true,
            'Last claim timestamp should have been updated'
        );

        assertWithLog(
            bondDataAfter.isActive,
            true,
            'Bond should still be active after claim'
        );
    });
});
