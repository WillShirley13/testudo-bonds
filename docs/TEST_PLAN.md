# Testudo Bonds – On-Chain Program Test Plan (v1.0)

This document provides a comprehensive test catalogue for the Testudo Bonds Solana program, with specific test function names and detailed descriptions based on the actual program implementation.

---

## 1. Core Instruction Tests (Happy Path)

### 1.1 InitializeAdmin Tests
| Test Function | Description | Assertions |
|---|---|---|
| `test_initialize_admin_success` | Initialize admin with valid authority, treasury, team, and native token mint | • GlobalAdmin PDA created with seeds `["global_admin"]`<br>• Admin data matches: authority, treasury, team addresses<br>• Default values: daily_emission_rate=55_000_000, max_emission_per_bond=20_000_000_000<br>• token_deposit_split=[4000,4000,2000], claim_penalty=500<br>• All ATAs created and rent-exempt |
| `test_initialize_admin_creates_atas` | Verify ATA creation during admin initialization | • rewards_pool_ata owned by global_admin PDA<br>• treasury_ata owned by treasury wallet<br>• team_ata owned by team wallet<br>• All accounts have correct mint |

### 1.2 CreateUser Tests  
| Test Function | Description | Assertions |
|---|---|---|
| `test_create_user_success` | Create new user PDA with valid wallet | • User PDA created with seeds `["user", wallet_pubkey]`<br>• UserAccount data: user=wallet, bond_count=0, total_accrued_rewards=0<br>• active_bonds=[], bond_index=0 |
| `test_create_user_idempotent_failure` | Attempt to create user PDA twice | • Second call fails with `ExpectedEmptyAccount` error |

### 1.3 InitializeBond Tests
| Test Function | Description | Assertions |
|---|---|---|
| `test_initialize_bond_success` | Create bond with valid user and 10 tokens | • Bond PDA created with seeds `["bond", user_pda, bond_index]`<br>• Bond data: owner=user_pda, bond_index=0, is_active=true<br>• User's bond_count incremented, bond added to active_bonds<br>• 10 tokens transferred: 4 to rewards_pool, 4 to treasury, 2 to team |
| `test_initialize_bond_token_split_calculation` | Verify correct token distribution | • Rewards pool receives 4_000_000_000 tokens (40%)<br>• Treasury receives 4_000_000_000 tokens (40%)<br>• Team receives 2_000_000_000 tokens (20%) |
| `test_initialize_bond_max_bonds_limit` | Create 10 bonds, then attempt 11th | • First 10 bonds succeed<br>• 11th bond fails with `MaxBondsReached` error |

### 1.4 ProcessClaim Tests
| Test Function | Description | Assertions |
|---|---|---|
| `test_process_claim_basic_rewards` | Claim rewards after 1 day | • Reward = 55_000_000 tokens (0.055 TESTUDO)<br>• Bond's total_claimed updated<br>• last_claim_timestamp updated<br>• Tokens transferred to user wallet |
| `test_process_claim_with_penalty` | Claim rewards within 5 days of creation | • Reward = 55_000_000 * 0.95 = 52_250_000 (5% penalty)<br>• Penalty applied correctly |
| `test_process_claim_max_emission_cap` | Claim when approaching max emission limit | • total_claimed + current_reward ≤ 20_000_000_000<br>• Bond deactivated when cap reached |
| `test_process_claim_auto_compound` | Test auto-compound functionality | • Old bond claimed successfully<br>• New bond created if auto_compound=true |

### 1.5 UpdateAdmin Tests
| Test Function | Description | Assertions |
|---|---|---|
| `test_update_admin_success` | Update admin configuration with valid authority | • Admin data updated with new values<br>• Authority verification successful |

---

## 2. Security Tests (Negative Path)

### 2.1 Authorization & Signer Tests
| Test Function | Description | Expected Error |
|---|---|---|
| `test_initialize_admin_wrong_signer` | Call InitializeAdmin without authority signature | `ExpectedSignerAccount` |
| `test_initialize_admin_already_initialized` | Call InitializeAdmin on existing admin PDA | `ExpectedEmptyAccount` |
| `test_update_admin_wrong_authority` | Call UpdateAdmin with non-authority signer | `AccountMismatch` |
| `test_process_claim_not_bond_owner` | User tries to claim another user's bond | `AccountMismatch` |
| `test_create_user_wrong_seeds` | Create user PDA with incorrect wallet in seeds | `InvalidPda` |

### 2.2 PDA Validation Tests
| Test Function | Description | Expected Error |
|---|---|---|
| `test_initialize_admin_invalid_pda_seeds` | Supply admin account with wrong seeds | `InvalidPda` |
| `test_initialize_bond_invalid_user_pda` | Supply bond with user PDA having wrong seeds | `InvalidPda` |
| `test_initialize_bond_wrong_bump` | Supply PDA with correct seeds but wrong bump | `InvalidPda` |
| `test_process_claim_invalid_bond_pda` | Supply bond PDA with incorrect derivation | `InvalidPda` |

### 2.3 Account Ownership Tests
| Test Function | Description | Expected Error |
|---|---|---|
| `test_initialize_admin_fake_token_program` | Pass attacker-controlled program as token_program | `IncorrectProgramId` |
| `test_initialize_admin_fake_system_program` | Pass attacker-controlled program as system_program | `IncorrectProgramId` |
| `test_initialize_bond_attacker_owned_mint` | Use mint owned by attacker instead of expected mint | `InvalidProgramOwner` |
| `test_process_claim_fake_rewards_pool` | Supply attacker-controlled account as rewards pool | `AccountMismatch` |

### 2.4 Token Account Validation Tests
| Test Function | Description | Expected Error |
|---|---|---|
| `test_initialize_bond_wrong_mint_ata` | Supply ATA with different mint | `AccountMismatch` |
| `test_initialize_bond_non_ata_account` | Supply regular account instead of ATA | `AccountMismatch` |
| `test_initialize_bond_insufficient_tokens` | User has < 10 tokens in wallet | `InsufficientTokens` |
| `test_process_claim_insufficient_rewards_pool` | Rewards pool has insufficient balance | `InsufficientRewards` |

### 2.5 Business Logic Validation Tests
| Test Function | Description | Expected Error |
|---|---|---|
| `test_process_claim_inactive_bond` | Try to claim from deactivated bond | `BondNotActive` |
| `test_process_claim_invalid_bond_index` | Supply bond_index not in user's active_bonds | `InvalidBondIndex` |
| `test_process_claim_no_rewards` | Claim immediately after creation (0 seconds) | `NoRewardsToClaim` |
| `test_initialize_bond_operations_paused` | Create bond when admin has paused operations | `BondOperationsPaused` |

### 2.6 Mathematical Overflow Tests
| Test Function | Description | Expected Error |
|---|---|---|
| `test_calculate_reward_overflow` | Force overflow in reward calculation | `NumericalOverflow` |
| `test_claim_penalty_underflow` | Force underflow in penalty calculation | `NumericalOverflow` |
| `test_bond_index_overflow` | Create bonds until bond_index overflows u8 | `NumericalOverflow` |

---

## 3. Edge Case Tests

### 3.1 Boundary Value Tests
| Test Function | Description | Purpose |
|---|---|---|
| `test_claim_exactly_5_days` | Claim at exactly 5 days (432000 seconds) | Verify penalty boundary condition |
| `test_claim_at_max_emission` | Claim when total_claimed = max_emission - 1 | Test emission cap boundary |
| `test_bond_creation_at_max_count` | Create 10th bond (max_bonds_per_wallet) | Test count boundary |
| `test_reward_calculation_precision` | Test reward calculation with various time periods | Verify mathematical precision |

### 3.2 State Transition Tests
| Test Function | Description | Purpose |
|---|---|---|
| `test_bond_lifecycle_complete` | Create → Claim multiple times → Deactivate | Full bond lifecycle |
| `test_user_multiple_bonds_management` | Create multiple bonds, claim from different ones | Multi-bond state management |
| `test_admin_config_updates` | Update various admin parameters | Configuration change handling |

---

## 4. Concurrency & Race Condition Tests

### 4.1 Duplicate Account Tests
| Test Function | Description | Expected Behavior |
|---|---|---|
| `test_duplicate_mutable_accounts` | Pass same account as multiple mutable parameters | Solana runtime rejects |
| `test_concurrent_bond_creation` | Simulate multiple bond creations in same slot | Proper serialization |
| `test_claim_race_condition` | Multiple claims on same bond simultaneously | Only one succeeds |

---

## 5. Program-Specific Security Tests

### 5.1 Cross-Program Invocation Tests
| Test Function | Description | Expected Error |
|---|---|---|
| `test_arbitrary_cpi_token_program` | Supply fake token program for CPI | `IncorrectProgramId` |
| `test_arbitrary_cpi_system_program` | Supply fake system program for CPI | `IncorrectProgramId` |

### 5.2 Account Substitution Tests
| Test Function | Description | Expected Error |
|---|---|---|
| `test_type_cosplay_user_as_admin` | Pass UserAccount where GlobalAdmin expected | Account type mismatch |
| `test_type_cosplay_bond_as_user` | Pass Bond account where UserAccount expected | Account type mismatch |

### 5.3 Sysvar Validation Tests
| Test Function | Description | Expected Error |
|---|---|---|
| `test_fake_clock_sysvar` | Pass attacker account as Clock sysvar | `InvalidAccountKey` |
| `test_fake_rent_sysvar` | Pass attacker account as Rent sysvar | `InvalidAccountKey` |

---

## 6. Economic Attack Tests

### 6.1 Token Economic Tests
| Test Function | Description | Purpose |
|---|---|---|
| `test_reward_pool_drainage` | Attempt to drain rewards pool beyond available balance | Verify economic bounds |
| `test_claim_timing_manipulation` | Test various claim timing strategies | Verify penalty mechanics |
| `test_max_bonds_economic_impact` | Create max bonds and claim from all | Test system economic limits |

---

## 7. Integration Tests

### 7.1 Full Protocol Flow Tests
| Test Function | Description | Purpose |
|---|---|---|
| `test_complete_protocol_flow` | Admin init → User create → Bond create → Claim → Update admin | End-to-end validation |
| `test_multi_user_interaction` | Multiple users creating bonds and claiming | Multi-user system behavior |
| `test_admin_emergency_procedures` | Pause operations, update config, resume | Emergency response validation |

---

## 8. Constants & Configuration Tests

### 8.1 Default Value Tests
| Test Function | Description | Assertions |
|---|---|---|
| `test_default_admin_constants` | Verify default admin configuration values | • DAILY_EMISSION_RATE = 55_000_000<br>• MAX_EMISSION_PER_BOND = 20_000_000_000<br>• CLAIM_PENALTY = 500<br>• SHELLS_PER_TESTUDO = 1_000_000_000 |

---

## 9. Test Implementation Notes

### 9.1 Test Structure
- **Framework**: AVA with TypeScript
- **RPC**: Local validator (solana-test-validator)
- **Client**: Generated TypeScript SDK from IDL
- **Setup**: Shared helper functions for keypair generation, funding, mint creation

### 9.2 Test Data
- **Token Decimals**: 9 (1 TESTUDO = 1_000_000_000 shells)
- **Test Amounts**: 10 TESTUDO = 10_000_000_000 shells
- **Time Simulation**: Mock clock for timestamp manipulation

### 9.3 Error Validation
Each negative test must verify:
1. Correct error type returned
2. No state changes occurred
3. No token transfers happened
4. Account states remain consistent

### 9.4 Test Organization
```
tests/
├── unit/
│   ├── initialize-admin.test.ts
│   ├── create-user.test.ts
│   ├── initialize-bond.test.ts
│   ├── process-claim.test.ts
│   └── update-admin.test.ts
├── security/
│   ├── authorization.test.ts
│   ├── pda-validation.test.ts
│   ├── account-ownership.test.ts
│   └── business-logic.test.ts
├── integration/
│   ├── protocol-flow.test.ts
│   └── multi-user.test.ts
└── helpers/
    ├── setup.ts
    ├── keypairs.ts
    └── assertions.ts
``` 