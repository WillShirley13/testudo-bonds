# Bankrun Time Travel Implementation Guide

## Problem Analysis

Your current implementation in `03-bond.test.ts` fails because you're mixing two different execution contexts:

1. **Regular Solana Test Validator**: Your test setup uses `createSolanaRpc('http://127.0.0.1:8899')` which connects to the standard Solana test validator
2. **Bankrun Context**: You create a separate Bankrun context with `start([], [])` for time manipulation

### Why This Fails

```typescript
// ❌ WRONG: This creates a separate, isolated context
const context = await start([], []);  
const currentClock = await context.banksClient.getClock();

// Time manipulation happens in the Bankrun context
context.setClock(newClock);

// But your RPC calls still go to the regular validator
let bondPdaAccountAfter = await fetchEncodedAccount(rpc, bondPda); // ❌ Wrong context!
```

The bond was created in the regular validator context, but you're trying to manipulate time in a completely separate Bankrun context. These contexts don't share state.

## Correct Implementation

### Key Principles

1. **Use Bankrun from the start**: Initialize your entire test environment using Bankrun
2. **Single context**: All operations (account creation, transactions, time manipulation) must happen in the same Bankrun context
3. **Use BanksClient**: Replace RPC calls with BanksClient methods

### Implementation Steps

#### 1. Initialize Bankrun Context

```typescript
import { start, Clock, BanksClient, ProgramTestContext } from 'solana-bankrun';

// Start with your program loaded
const programId = sdk.TESTUDO_BONDS_PROGRAM_ADDRESS;
const context = await start([{ name: 'testudo_bonds', programId }], []);
const banksClient = context.banksClient;
```

#### 2. Replace RPC Operations

```typescript
// ❌ Old way (RPC)
const account = await fetchEncodedAccount(rpc, address);
await rpc.requestAirdrop(keypair.address, amount);

// ✅ New way (BanksClient)
const account = await banksClient.getAccount(address);
await banksClient.requestAirdrop(keypair.address, amount);
```

#### 3. Execute Transactions

```typescript
// Build transaction message as usual
const transactionMessage = pipe(
    createTransactionMessage({ version: 0 }),
    (tx) => setTransactionMessageFeePayer(signer.address, tx),
    (tx) => setTransactionMessageLifetimeUsingBlockhash(context.lastBlockhash, tx),
    (tx) => appendTransactionMessageInstruction(instruction, tx)
);

// Sign and process through BanksClient
const signedTransaction = await signTransactionMessageWithSigners(transactionMessage);
await banksClient.processTransaction(signedTransaction);
```

#### 4. Time Manipulation

```typescript
// Get current time
const currentClock = await banksClient.getClock();

// Create new clock with advanced time
const newClock = new Clock(
    currentClock.slot + 1000n, // Advance slot too
    currentClock.epochStartTimestamp,
    currentClock.epoch,
    currentClock.leaderScheduleEpoch,
    currentClock.unixTimestamp + timeAdvanceInSeconds
);

// Apply time change
context.setClock(newClock);

// Verify change
const updatedClock = await banksClient.getClock();
console.log('Time advanced by:', updatedClock.unixTimestamp - currentClock.unixTimestamp);
```

## Complete Working Example

See `clients/js/test/unit/04-bond-bankrun.test.ts` for a complete implementation that:

1. ✅ Initializes Bankrun context with the program
2. ✅ Creates all accounts using BanksClient
3. ✅ Executes bond creation transaction
4. ✅ Advances time by 30 days
5. ✅ Successfully claims rewards (no more "No rewards to claim" error)

## Common Pitfalls

### 1. Context Mixing
```typescript
// ❌ Don't do this
const rpc = createSolanaRpc('http://127.0.0.1:8899'); // Regular validator
const context = await start([], []); // Separate Bankrun context
```

### 2. Forgetting to Advance Slot
```typescript
// ❌ Only advancing timestamp
const newClock = new Clock(
    currentClock.slot, // Same slot
    currentClock.epochStartTimestamp,
    currentClock.epoch,
    currentClock.leaderScheduleEpoch,
    currentClock.unixTimestamp + timeAdvance
);

// ✅ Advance both timestamp and slot
const newClock = new Clock(
    currentClock.slot + 1000n, // Advance slot
    currentClock.epochStartTimestamp,
    currentClock.epoch,
    currentClock.leaderScheduleEpoch,
    currentClock.unixTimestamp + timeAdvance
);
```

### 3. Using Wrong Account Fetching
```typescript
// ❌ Using RPC in Bankrun context
const account = await fetchEncodedAccount(rpc, address);

// ✅ Using BanksClient
const account = await banksClient.getAccount(address);
```

## Migration Strategy

If you have existing tests using the regular validator:

1. **Create separate Bankrun tests**: Don't modify existing tests that work
2. **Use Bankrun for time-sensitive tests**: Only use Bankrun when you need time manipulation
3. **Consider test isolation**: Bankrun tests should be in separate files to avoid context conflicts

## Performance Considerations

- Bankrun is faster than the regular validator for most operations
- Each test should create its own Bankrun context for isolation
- Consider using `beforeEach` to reset context between tests

## Error Debugging

When debugging Bankrun issues:

1. **Check context consistency**: Ensure all operations use the same context
2. **Verify program loading**: Make sure your program is loaded in the Bankrun context
3. **Account existence**: Use `banksClient.getAccount()` to verify accounts exist
4. **Time verification**: Always verify time changes with `banksClient.getClock()`

## Summary

The key insight is that **Bankrun provides a complete, isolated blockchain environment**. You can't mix it with the regular validator - you must choose one or the other for your entire test. For time manipulation, Bankrun is the only viable option.