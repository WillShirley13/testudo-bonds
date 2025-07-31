# Testudo Bonds – On-Chain Program Test Plan (v0.1 draft)

This document is an initial catalogue of tests we must implement to confirm
both functional correctness and resistance to the most common Solana-specific
attack vectors.

---

## 1 Functional / Happy-Path Tests

| ID | Instruction / Feature | What we assert |
|---|---|---|
| F-1 | `initialize_admin` | • All PDAs derived as expected  <br>• Rewards-pool ATA, treasury ATA, team ATA are created & rent-exempt  <br>• `GlobalAdmin` state matches inputs |
| F-2 | `create_user` | • New `User` PDA created with correct seeds  <br>• Idempotent – second call for same wallet fails with custom error |
| F-3 | `create_bond` | • Bond PDA created, mint/quantity saved  <br>• Funds locked in escrow vault ATA |
| F-4 | `redeem_bond` | • Correct user & bond PDAs supplied  <br>• Bond state → *Redeemed*  <br>• Tokens or SOL transferred to user |
| F-5 | `distribute_rewards` | • Only admin can trigger <br>• Rewards minted / transferred according to config |
| F-6 | Pause / unpause (if exists) | • All state-changing calls blocked when paused and succeed when unpaused |

---

## 2 Security / Negative-Path Tests

### 2.1 Authority & Signer

| ID | Scenario | Expectation |
|---|---|---|
| S-1 | Call `initialize_admin` with wrong fee-payer signer | Transaction fails with `MissingRequiredSignature` |
| S-2 | Replay old `initialize_admin` txn after state exists | Fails with `AccountAlreadyInitialized` |
| S-3 | Try admin-only op (`distribute_rewards`) signed by non-admin | Fails with `InvalidAdminAccount` |

### 2.2 PDA / Seed Validation

| ID | Scenario | Expectation |
|---|---|---|
| S-4 | Supply fake PDA with correct seeds but wrong bump | Instruction rejects (`InvalidSeeds`) |
| S-5 | Swap user-supplied accounts so that treasury ATA points to attacker | Transaction fails due to owner / seed checks |

### 2.3 Ownership Checks

| ID | Scenario | Expectation |
|---|---|---|
| S-6 | Pass account owned by attacker where program expects token-program owner | Fails with `IllegalOwner` |
| S-7 | Pass fake sysvar instead of genuine `Rent` sysvar | Fails with `InvalidSysvar` |

### 2.4 Token Account Safety

| ID | Scenario | Expectation |
|---|---|---|
| S-8 | Attempt to initialize admin with treasury ATA that already exists & owned by attacker | Rejected (owner mismatch) |
| S-9 | Provide token account with different mint | Rejected (`MintMismatch`) |

### 2.5 Unchecked Math / Bounds

| ID | Scenario | Expectation |
|---|---|---|
| S-10 | Overflow bond amount (u64::MAX) | Transaction fails via checked math path |
| S-11 | Underflow when redeeming more than locked amount | Fails gracefully |

### 2.6 CPI / Arbitrary Program Invocation

| ID | Scenario | Expectation |
|---|---|---|
| S-12 | Replace SPL-Token program id with spoofed program | `IncorrectProgramId` error |
| S-13 | CPI depth >=4 recursion attempt | Program aborts with `ExceededMaxDepth` (implicit) |

### 2.7 Re-Initialization & Account Substitution (Type Cosplay)

| ID | Scenario | Expectation |
|---|---|---|
| S-14 | Re-run `initialize_admin` with already initialised GlobalAdmin PDA | Fails (`AccountAlreadyInitialized`) |
| S-15 | Pass User PDA where GlobalAdmin expected (same owner) | Fails discriminator/type check |

### 2.8 Close / Garbage-Collect Safety

| ID | Scenario | Expectation |
|---|---|---|
| S-16 | Close bond vault then reuse account in same tx | Reuse prevented by closed-account discriminator |
| S-17 | Fund a closed account mid-tx (defund grief) | `force_defund` succeeds; regular ops fail |

---

## 3 Edge-Case & Stress Tests

| ID | Description |
|---|---|
| E-1 | Run all critical paths under 1 lamport remaining in program-owned account (rent edge) |
| E-2 | Fuzz seeds to ensure no PDA collision across instructions |
| E-3 | Simulate 1,000 concurrent bond creations in same slot (account duplication, duplicate mutables) |

---

## 4 Denial-of-Service / Front-Running

| ID | Scenario | Expectation |
|---|---|---|
| D-1 | Admin bumps sale price between buyer `create_bond` & `redeem_bond` commit-reveal flow | Buyer tx includes expected price guard -> fails safely |
| D-2 | Dusting: send 1 token to vault before withdraw causes require-zero check | Withdraw rejects attacker, still allows legitimate flow |

---

## 5 Audit-Check List Mapping

The tests above explicitly target the top Solana pitfalls highlighted by:

* Neodyme “Common Pitfalls” (ownership, signer, integer math, PDA substitution)
* Helius “Hitchhiker’s Guide” (account reload, arbitrary CPI, bump canonicalisation)
* SlowMist best-practices repo
* Halborn blog (seed collisions, type cosplay)

---

## 6 Next Steps

1. Review this list with protocol team; prune or extend as needed.
2. For each test, decide: JavaScript/TypeScript AVA unit, Anchor mocha, or on-chain fuzz (e.g. Solana-Fuzz) implementation.
3. Implement harness scaffolding (we already have AVA + @solana/kit helpers).
4. Automate in CI to run against localnet & devnet deployments.

*Source links kept separately for brevity.*
