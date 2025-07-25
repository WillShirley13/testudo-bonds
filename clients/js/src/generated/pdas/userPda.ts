/**
 * This code was AUTOGENERATED using the codama library.
 * Please DO NOT EDIT THIS FILE, instead use visitors
 * to add features, then rerun codama to update it.
 *
 * @see https://github.com/codama-idl/codama
 */

import {
    getAddressEncoder,
    getProgramDerivedAddress,
    getUtf8Encoder,
    type Address,
    type ProgramDerivedAddress,
} from '@solana/kit';

export type UserPdaSeeds = {
    /** The wallet of the user */
    userWallet: Address;
};

export async function findUserPdaPda(
    seeds: UserPdaSeeds,
    config: { programAddress?: Address | undefined } = {}
): Promise<ProgramDerivedAddress> {
    const {
        programAddress = 'AV5obcm5Yavs4EebSrmonAAy2K83NZZK88gUn77wmK2' as Address<'AV5obcm5Yavs4EebSrmonAAy2K83NZZK88gUn77wmK2'>,
    } = config;
    return await getProgramDerivedAddress({
        programAddress,
        seeds: [
            getUtf8Encoder().encode('user'),
            getAddressEncoder().encode(seeds.userWallet),
        ],
    });
}
