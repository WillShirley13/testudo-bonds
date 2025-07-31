import { describe, it, expect } from 'vitest';
import { getTestContext, SHELLS_PER_TESTUDO } from '../helpers/setup';
import { KeyPairSigner, Address, pipe, createTransactionMessage, setTransactionMessageFeePayer, setTransactionMessageLifetimeUsingBlockhash, appendTransactionMessageInstruction, signTransactionMessageWithSigners, sendAndConfirmTransactionFactory, fetchEncodedAccount, assertAccountExists } from '@solana/kit';
import * as sdk from '../../src/index';
import { assertWithLog } from '../helpers/assertions';
// InitializeBond instruction tests
// This file will contain all tests related to the InitializeBond instruction 

describe('Bond Instructions', async () => {
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
        setNewAdminAuthority,
        fundKeypair,
        mintTokensToUser,
        confirmTransaction,
        getLatestBlockhash,
        createUserPda,
        createAta,
    } = await getTestContext();

    console.log(' Admin authority: ', adminAuthority.address);
    it('should initialize a bond', async () => {
        const user: KeyPairSigner = user1;
        console.log('user', user.address);
        const [userPda] = await sdk.findUserPdaPda({ userWallet: user.address });
        console.log('userPda', userPda);
        //confirm userPda exists
        let userPdaAccount = await fetchEncodedAccount(rpc, userPda);
        assertAccountExists(userPdaAccount);
        console.log('userPdaAccount exists: ', userPdaAccount.exists);

        let userPdaAccountData = sdk.getUserPdaCodec().decode(userPdaAccount.data);
        let newBondIndex = userPdaAccountData.bondIndex;
        let [bondPda] = await sdk.findBondPda({
            userPda: userPda,
            bondIndex: newBondIndex,
        });

        // Create (or fetch) the user’s associated token account via the shared helper
        const userWalletAta: Address = await createAta(user);

        console.log("Minting tokens to user");
        await mintTokensToUser(user, BigInt(10 * SHELLS_PER_TESTUDO));
        let userTokenBalance = await rpc.getTokenAccountBalance(userWalletAta).send();
        console.log('userTokenBalance', userTokenBalance.value.amount);

        // Confirm existance of rewardsPoolAta, treasuryAta, teamAta
        let rewardsPoolAtaAccount = await fetchEncodedAccount(rpc, rewardsPoolAta);
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
            userPda: userPda,  // Explicitly pass userPda
            globalAdmin: globalAdminPda,  // Add missing global admin
            userWalletAta: userWalletAta,
            rewardsPoolAta: rewardsPoolAta,
            treasuryAta: treasuryAta,
            teamAta: teamAta,
            nativeTokenMint: nativeTokenMint,
        });

        let recentBlockhash = (await rpc.getLatestBlockhash().send()).value;

        console.log("Invoking initialize bond instruction");

        let transactionMsg = pipe(
            createTransactionMessage({ version: 0 }),
            (tx) => setTransactionMessageFeePayer(user.address, tx),
            (tx) => setTransactionMessageLifetimeUsingBlockhash(recentBlockhash, tx),
            (tx) => appendTransactionMessageInstruction(initBondIx, tx)
        );

        let transactionSig2 = await signTransactionMessageWithSigners(transactionMsg);

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
                console.log('Compute units consumed:', error.context.unitsConsumed?.toString());
                
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
        assertAccountExists(bondPdaAccount)

        let bondData = await sdk.getBondCodec().decode(bondPdaAccount.data);

        assertWithLog(bondData.owner, userPda, 'Bond owner should be the user');
        assertWithLog(bondData.bondIndex, newBondIndex, 'Bond index should be the new bond index');
        assertWithLog(bondData.lastClaimTimestamp, bondData.creationTimestamp, 'Upon creation, last claim and creation timestamps should be the same');
        assertWithLog(bondData.totalClaimed, 0n, 'Bond total claimed should be 0');
        assertWithLog(bondData.isActive, true, 'Bond should be active');
    });
}); 