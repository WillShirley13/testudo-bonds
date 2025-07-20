# Testudo Bonds SDK Reference

This document provides a comprehensive breakdown of all helper functions available in the Testudo Bonds JavaScript SDK.

## Table of Contents

1. [Account Fetchers](#account-fetchers)
2. [Account Decoders](#account-decoders)
3. [PDA Finders](#pda-finders)
4. [Instruction Builders](#instruction-builders)
5. [Instruction Parsers](#instruction-parsers)
6. [Type Codecs](#type-codecs)
7. [Error Handling](#error-handling)
8. [Program Constants](#program-constants)

## Account Fetchers

### Bond Account

- `fetchBond(rpc, address, config?)` - Fetch a single bond account
- `fetchMaybeBond(rpc, address, config?)` - Fetch bond account (may not exist)
- `fetchAllBond(rpc, addresses, config?)` - Fetch multiple bond accounts
- `fetchAllMaybeBond(rpc, addresses, config?)` - Fetch multiple bond accounts (may not exist)
- `fetchBondFromSeeds(rpc, seeds, config?)` - Fetch bond using PDA seeds
- `fetchMaybeBondFromSeeds(rpc, seeds, config?)` - Fetch bond using PDA seeds (may not exist)

### GlobalAdmin Account

- `fetchGlobalAdmin(rpc, address, config?)` - Fetch global admin account
- `fetchMaybeGlobalAdmin(rpc, address, config?)` - Fetch global admin account (may not exist)
- `fetchAllGlobalAdmin(rpc, addresses, config?)` - Fetch multiple global admin accounts
- `fetchAllMaybeGlobalAdmin(rpc, addresses, config?)` - Fetch multiple global admin accounts (may not exist)
- `fetchGlobalAdminFromSeeds(rpc, config?)` - Fetch global admin using PDA seeds
- `fetchMaybeGlobalAdminFromSeeds(rpc, config?)` - Fetch global admin using PDA seeds (may not exist)

### UserPda Account

- `fetchUserPda(rpc, address, config?)` - Fetch user PDA account
- `fetchMaybeUserPda(rpc, address, config?)` - Fetch user PDA account (may not exist)
- `fetchAllUserPda(rpc, addresses, config?)` - Fetch multiple user PDA accounts
- `fetchAllMaybeUserPda(rpc, addresses, config?)` - Fetch multiple user PDA accounts (may not exist)
- `fetchUserPdaFromSeeds(rpc, seeds, config?)` - Fetch user PDA using seeds
- `fetchMaybeUserPdaFromSeeds(rpc, seeds, config?)` - Fetch user PDA using seeds (may not exist)

## Account Decoders

### Bond

- `decodeBond(encodedAccount)` - Decode bond account data
- `getBondEncoder()` - Get bond account encoder
- `getBondDecoder()` - Get bond account decoder
- `getBondCodec()` - Get bond account codec (encoder + decoder)
- `getBondSize()` - Get bond account size in bytes (58 bytes)

### GlobalAdmin

- `decodeGlobalAdmin(encodedAccount)` - Decode global admin account data
- `getGlobalAdminEncoder()` - Get global admin encoder
- `getGlobalAdminDecoder()` - Get global admin decoder
- `getGlobalAdminCodec()` - Get global admin codec
- `getGlobalAdminSize()` - Get global admin account size in bytes (186 bytes)

### UserPda

- `decodeUserPda(encodedAccount)` - Decode user PDA account data
- `getUserPdaEncoder()` - Get user PDA encoder
- `getUserPdaDecoder()` - Get user PDA decoder
- `getUserPdaCodec()` - Get user PDA codec

## PDA Finders

### Bond PDA

- `findBondPda(seeds, config?)` - Find bond PDA address
  - Seeds: `{ userPda: Address, bondIndex: number }`
  - Returns: `ProgramDerivedAddress`

### GlobalAdmin PDA

- `findGlobalAdminPda(config?)` - Find global admin PDA address
  - No seeds required (uses 'global_admin' seed)
  - Returns: `ProgramDerivedAddress`

### UserPda PDA

- `findUserPdaPda(seeds, config?)` - Find user PDA address
  - Seeds: `{ userWallet: Address }`
  - Returns: `ProgramDerivedAddress`

## Instruction Builders

### Initialize Admin

- `getInitializeAdminInstruction(input, config?)` - Build initialize admin instruction (sync)
- `getInitializeAdminInstructionAsync(input, config?)` - Build initialize admin instruction (async with PDA resolution)

**Input Parameters:**

```typescript
{
  globalAdmin?: Address,           // Optional - auto-derived if not provided
  authority: TransactionSigner,    // Required - admin authority
  rewardsPoolAta: Address,        // Required - rewards pool token account
  treasury: Address,              // Required - treasury account
  treasuryAta: Address,           // Required - treasury token account  
  team: Address,                  // Required - team account
  teamAta: Address,               // Required - team token account
  nativeTokenMint: Address,       // Required - native token mint
  systemProgram?: Address,        // Optional - defaults to system program
  tokenProgram?: Address,         // Optional - defaults to token program
  associatedTokenProgram: Address // Required - ATA program
}
```

### Create User

- `getCreateUserInstruction(input, config?)` - Build create user instruction (sync)
- `getCreateUserInstructionAsync(input, config?)` - Build create user instruction (async with PDA resolution)

**Input Parameters:**

```typescript
{
  userPda?: Address,              // Optional - auto-derived if not provided
  userWallet: TransactionSigner,  // Required - user's wallet
  systemProgram?: Address         // Optional - defaults to system program
}
```

### Initialize Bond

- `getInitializeBondInstruction(input, config?)` - Build initialize bond instruction (sync)
- `getInitializeBondInstructionAsync(input, config?)` - Build initialize bond instruction (async with PDA resolution)

**Input Parameters:**

```typescript
{
  bond?: Address,                 // Optional - auto-derived if not provided
  userWallet: TransactionSigner,  // Required - user's wallet
  userPda?: Address,              // Optional - auto-derived if not provided
  globalAdmin?: Address,          // Optional - auto-derived if not provided
  userWalletAta: Address,         // Required - user's token account
  rewardsPoolAta: Address,        // Required - rewards pool token account
  treasuryAta: Address,           // Required - treasury token account
  teamAta: Address,               // Required - team token account
  nativeTokenMint: Address,       // Required - native token mint
  systemProgram?: Address,        // Optional - defaults to system program
  tokenProgram?: Address          // Optional - defaults to token program
}
```

### Process Claim

- `getProcessClaimInstruction(input, config?)` - Build process claim instruction (sync)
- `getProcessClaimInstructionAsync(input, config?)` - Build process claim instruction (async with PDA resolution)

**Input Parameters:**

```typescript
{
  bond?: Address,                    // Optional - auto-derived if not provided
  userWallet: TransactionSigner,     // Required - user's wallet
  userPda?: Address,                 // Optional - auto-derived if not provided
  userWalletAta: Address,            // Required - user's token account
  globalAdmin?: Address,             // Optional - auto-derived if not provided
  rewardsPoolAta: Address,           // Required - rewards pool token account
  treasuryAta: Address,              // Required - treasury token account
  teamAta: Address,                  // Required - team token account
  newBondPda?: Address,              // Optional - auto-derived if not provided
  nativeTokenMint: Address,          // Required - native token mint
  tokenProgram?: Address,            // Optional - defaults to token program
  associatedTokenProgram: Address,   // Required - ATA program
  systemProgram?: Address,           // Optional - defaults to system program
  bondIndex: number,                 // Required - bond index to claim from
  autoCompound: boolean              // Required - whether to auto-compound
}
```

### Update Admin

- `getUpdateAdminInstruction(input, config?)` - Build update admin instruction (sync)
- `getUpdateAdminInstructionAsync(input, config?)` - Build update admin instruction (async with PDA resolution)

**Input Parameters:**

```typescript
{
  globalAdmin?: Address,          // Optional - auto-derived if not provided
  authority: TransactionSigner    // Required - admin authority
}
```

## Instruction Parsers

### Parse Instructions

- `parseInitializeAdminInstruction(instruction)` - Parse initialize admin instruction
- `parseCreateUserInstruction(instruction)` - Parse create user instruction
- `parseInitializeBondInstruction(instruction)` - Parse initialize bond instruction
- `parseProcessClaimInstruction(instruction)` - Parse process claim instruction
- `parseUpdateAdminInstruction(instruction)` - Parse update admin instruction

### Instruction Identification

- `identifyTestudoBondsInstruction(instruction)` - Identify instruction type
- `TestudoBondsInstruction` enum - Available instruction types:
  - `InitializeAdmin` (0)
  - `CreateUser` (1)
  - `InitializeBond` (2)
  - `ProcessClaim` (3)
  - `UpdateAdmin` (4)

## Type Codecs

### Process Claim Payload

- `getProcessClaimPayloadEncoder()` - Encode process claim payload
- `getProcessClaimPayloadDecoder()` - Decode process claim payload
- `getProcessClaimPayloadCodec()` - Combined codec

### Update Admin Payload

- `getUpdateAdminPayloadEncoder()` - Encode update admin payload
- `getUpdateAdminPayloadDecoder()` - Decode update admin payload
- `getUpdateAdminPayloadCodec()` - Combined codec

## Error Handling

### Error Constants

- `TESTUDO_BONDS_ERROR__DESERIALIZATION_ERROR` (0)
- `TESTUDO_BONDS_ERROR__SERIALIZATION_ERROR` (1)
- `TESTUDO_BONDS_ERROR__INVALID_PROGRAM_OWNER` (2)
- `TESTUDO_BONDS_ERROR__INVALID_PDA` (3)
- `TESTUDO_BONDS_ERROR__EXPECTED_EMPTY_ACCOUNT` (4)
- `TESTUDO_BONDS_ERROR__EXPECTED_NON_EMPTY_ACCOUNT` (5)
- `TESTUDO_BONDS_ERROR__EXPECTED_SIGNER_ACCOUNT` (6)
- `TESTUDO_BONDS_ERROR__EXPECTED_WRITABLE_ACCOUNT` (7)
- `TESTUDO_BONDS_ERROR__ACCOUNT_MISMATCH` (8)
- `TESTUDO_BONDS_ERROR__INVALID_ACCOUNT_KEY` (9)
- `TESTUDO_BONDS_ERROR__NUMERICAL_OVERFLOW` (10)
- `TESTUDO_BONDS_ERROR__INSUFFICIENT_TOKENS` (11)
- `TESTUDO_BONDS_ERROR__INVALID_BOND_INDEX` (12)
- `TESTUDO_BONDS_ERROR__INVALID_TOKEN_ACCOUNTS` (13)
- `TESTUDO_BONDS_ERROR__NO_REWARDS_TO_CLAIM` (14)
- `TESTUDO_BONDS_ERROR__INSUFFICIENT_REWARDS` (15)
- `TESTUDO_BONDS_ERROR__BOND_NOT_ACTIVE` (16)
- `TESTUDO_BONDS_ERROR__MAX_BONDS_REACHED` (17)
- `TESTUDO_BONDS_ERROR__BOND_OPERATIONS_PAUSED` (18)
- `TESTUDO_BONDS_ERROR__BOND_IS_ACTIVE` (19)

### Error Utilities

- `getTestudoBondsErrorMessage(code)` - Get error message from code
- `isTestudoBondsError(error, transactionMessage, code?)` - Check if error is program error

## Program Constants

- `TESTUDO_BONDS_PROGRAM_ADDRESS` - Program ID: `AV5obcm5Yavs4EebSrmonAAy2K83NZZK88gUn77wmK2`

## Account Type Definitions

### Bond Account

```typescript
type Bond = {
  owner: Address;
  bondIndex: number;
  creationTimestamp: bigint;
  lastClaimTimestamp: bigint;
  totalClaimed: bigint;
  isActive: boolean;
}
```

### GlobalAdmin Account

```typescript
type GlobalAdmin = {
  authority: Address;
  treasury: Address;
  team: Address;
  rewardsPool: Address;
  nativeTokenMint: Address;
  dailyEmissionRate: bigint;
  maxEmissionPerBond: bigint;
  maxBondsPerWallet: number;
  tokenDepositSplit: Array<number>; // [3 elements]
  claimPenalty: number;
  pauseBondOperations: boolean;
}
```

### UserPda Account

```typescript
type UserPda = {
  user: Address;
  bondCount: number;
  totalAccruedRewards: bigint;
  activeBonds: Array<readonly [number, Address]>;
  bondIndex: number;
}
```

## Usage Patterns

### Common Async Pattern for Instructions

```typescript
// Use async versions for automatic PDA resolution
const instruction = await getInitializeBondInstructionAsync({
  userWallet: signer,
  userWalletAta: userTokenAccount,
  rewardsPoolAta: rewardsPool,
  treasuryAta: treasury,
  teamAta: team,
  nativeTokenMint: mint
});
```

### Common Sync Pattern for Instructions

```typescript
// Use sync versions when you already have addresses
const [userPda] = await findUserPdaPda({ userWallet: signer.address });
const [bond] = await findBondPda({ userPda: userPda[0], bondIndex: 0 });

const instruction = getInitializeBondInstruction({
  bond: bond[0],
  userWallet: signer,
  userPda: userPda[0],
  // ... other required accounts
});
``

### Account Fetching Pattern

```typescript
// Fetch with automatic error if account doesn't exist
const bondAccount = await fetchBond(rpc, bondAddress);

// Fetch with null if account doesn't exist  
const maybeBondAccount = await fetchMaybeBond(rpc, bondAddress);
if (maybeBondAccount.exists) {
  // Account exists, use maybeBondAccount.data
}```