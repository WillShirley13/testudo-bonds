# Testudo Bonds Protocol Onchain Architecture

## Overview

This document outlines the Solana onchain architecture for a sustainable bond-based rewards system. Core mechanics: Users deposit 10 NATIVE tokens (split 40% rewards pool, 40% treasury, 20% team via basis points) to mint a bond (PDA-based), which emits constant daily rewards (0.055 tokens/day pro-rata per second, up to 20 tokens total cap) with a 5% penalty if claimed within 5 days of last claim. Bonds deactivate after hitting emission cap. Built with native Solana programs using Shank for IDL generation.

### Key Principles

- **PDAs**: Used for deterministic, cheap accounts (seeded by pubkeys/strings).
- **Token Standard**: SPL for NATIVE (minted with fixed 1M supply, decimals=9 for precision).
- **Security**: Only wallet owners can claim; admin PDA for config updates (via UpdateAdmin instruction).
- **Computations**: On-the-fly reward calcs to minimize storage costs, with max emission cap enforcement.
- **Events**: Emit for all key actions (deposit, claim, death) for off-chain tracking.

### Accounts & PDAs

1. **Native Token Mint**
   - Type: SPL Mint Account.
   - Authority: Set externally (not managed by this program).
   - Supply: 1,000,000 (fixed; 20% bootstrapped to rewards pool).
   - Decimals: 9.

2. **Global Admin PDA**
   - Seeds: ["global_admin"].
   - Data:
     - `authority: Pubkey` - Admin pubkey (initially deployer's wallet; upgradable to multisig/DAO).
     - `treasury: Pubkey` - Treasury token account address.
     - `team: Pubkey` - Team token account address.
     - `rewards_pool: Pubkey` - Rewards pool token account address.
     - `native_token_mint: Pubkey` - The native token mint address.
     - `daily_emission_rate: u64` - Daily emission rate in token units (e.g., 55_000_000 for 0.055 tokens with 9 decimals).
     - `max_emission_per_bond: u64` - Maximum tokens per bond (20_000_000_000 for 20 tokens with 9 decimals).
     - `max_bonds_per_wallet: u8` - Maximum bonds per wallet (default: 10; enforced in InitializeBond).
     - `token_deposit_split: [u16; 3]` - Split in basis points [rewards_pool, treasury, team] (default: [4000, 4000, 2000]).
     - `claim_penalty: u16` - Penalty in basis points if claimed within 5 days of last claim (default: 500 = 5%).
   - Purpose: Central configurable params; admin can update via UpdateAdmin instruction.

3. **User Account PDA** (One per wallet)
   - Seeds: ["user", wallet_pubkey].
   - Data:
     - `user: Pubkey` - Wallet pubkey of the user.
     - `bond_count: u8` - Number of active bonds the user currently has.
     - `total_accrued_rewards: u64` - Total rewards accrued across all bonds (9 decimals).
     - `active_bonds: Vec<(u8, Pubkey)>` - Vector of (bond_index, bond_pda) tuples for active bonds.
     - `bond_index: u8` - Index for the next bond to be created (increments per bond).
   - Purpose: Aggregates user state; created on first deposit.

4. **Bond PDA** (One per bond)
   - Seeds: ["bond", user_pda, bond_index (u8)].
   - Data:
     - `owner: Pubkey` - User PDA pubkey that owns this bond.
     - `bond_index: u8` - Index of this bond for the user.
     - `creation_timestamp: i64` - Unix timestamp when bond was created.
     - `last_claim_timestamp: i64` - Last time rewards were claimed.
     - `total_claimed: u64` - Total amount claimed from this bond (in token units, 9 decimals).
     - `is_active: bool` - Whether the bond is active and can be claimed.
   - Purpose: Tracks individual bond state. On claim: Compute accrual since last_claim as (daily_emission * seconds_elapsed / 86400), subtract 5% penalty if <5 days since last claim, cap at max_emission_per_bond - total_claimed in calculate_reward function, transfer from rewards pool if active and pool has balance. Deactivate and remove from user's active_bonds if cap reached.

5. **Token Accounts** (SPL Token Accounts, associated token accounts)
   - **Rewards Pool ATA**: Associated token account owned by Global Admin PDA for holding emission tokens.
   - **Treasury ATA**: Associated token account owned by treasury wallet for yield-generating deployments.
   - **Team ATA**: Associated token account owned by team wallet for vested withdrawals.
   - **User Wallet ATA**: Associated token account owned by user wallet for deposits and reward claims.
   - Purpose: Secure storage for split deposits and reward distribution. Program instructions handle transfers.

### Instructions (Core Program)

#### InitializeAdmin

Creates the global admin account and associated token accounts if needed.
**Accounts:**
- `[writable] admin_pda` - Global admin PDA (seeds: ["global_admin"]).
- `[signer] authority` - Initial authority.
- `[writable] rewards_pool_ata` - Rewards pool ATA (created if empty).
- `[signer] treasury` - Treasury wallet (signer for ATA creation).
- `[writable] treasury_ata` - Treasury ATA (created if empty).
- `[signer] team` - Team wallet (signer for ATA creation).
- `[writable] team_ata` - Team ATA (created if empty).
- `native_token_mint` - Native token mint.
- `system_program` - System program.
- `token_program` - Token program.
- `associated_token_program` - Associated token program.

Data: Sets defaults like daily_emission_rate=55_000_000 (0.055 tokens), max_emission_per_bond=20_000_000_000 (20 tokens), claim_penalty=500 (5%), token_deposit_split=[4000,4000,2000].

#### CreateUser (InitializeUser)

Creates a new user account PDA.
**Accounts:**
- `[writable] user_pda` - User PDA (seeds: ["user", user_wallet]).
- `[signer] user_wallet` - User's wallet.
- `system_program` - System program.
- (Unused slot in code).

#### InitializeBond

Creates a new bond account and transfers 10 tokens from user's ATA, split by basis points to pools. Enforces max_bonds_per_wallet limit.
**Accounts:**
- `[writable] bond_pda` - Bond PDA (seeds: ["bond", user_pda, bond_index]).
- `[signer] user_wallet` - User's wallet (signer and transfer authority).
- `[writable] user_pda` - User's PDA.
- `global_admin` - Global admin PDA.
- `[writable] user_wallet_ata` - User's associated token account (source of deposit).
- `[writable] rewards_pool_ata` - Rewards pool ATA.
- `[writable] treasury_ata` - Treasury ATA.
- `[writable] team_ata` - Team ATA.
- `native_token_mint` - Native token mint.
- `token_program` - Token program.
- `system_program` - System program.
- (Unused slot in code).

Validations: Checks user_pda_data.bond_count < global_admin_data.max_bonds_per_wallet, validates user_wallet_ata is correct ATA for user_wallet and native_token_mint, ensures user has ≥10 tokens.

#### ProcessClaim

Claims rewards from a bond, transfers to user_wallet_ata. If auto_compound is true, creates a new bond with the same user_pda and bond_index. Also, if bond hits max emission upon current claim the instruction closes the bond.
**Accounts:**

- `[writable] bond_pda` - Bond PDA (seeds: ["bond", user_pda, bond_index]).
- `[signer, writable] user_wallet` - User's wallet (signer and transfer destination - bug: should be user's ATA).
- `[writable] user_pda` - User's PDA.
- `global_admin` - Global admin PDA.
- `[writable] rewards_pool_ata` - Rewards pool ATA.
- `native_token_mint` - Native token mint.
- `token_program` - Token program.
- `associated_token_program` - Associated token program.
- `system_program` - System program.

**Parameters:**

- `bond_index: u8` - Index of the bond to claim from (via ProcessClaimPayload).

Reward calculation: Uses updated calculate_reward function with max_emission_per_bond and total_claimed parameters to cap rewards automatically.

#### UpdateAdmin

Updates the global admin configuration.
**Accounts:**

- `[writable] global_admin` - Global admin PDA (seeds: ["global_admin"]).
- `[signer] authority` - Current authority (must match admin_data.authority).

**Parameters:**

- `new_admin_data: Admin` - Complete new admin configuration (via UpdateAdminPayload).

### Program Structure

- **Core Program** (Native Solana): Handles deposits, claims, bond lifecycle using Shank for IDL generation.
- **State Management**: Three main account types (Admin, UserAccount, Bond) with serialization traits.
- **Error Handling**: Custom error types for validation and program flow control.
- **Utilities**: Modular utility functions for account creation, token transfers, and reward calculations.

### Account Size Calculations

- **Admin**: 32*5 + 8*2 + 1 + (3*2) + 2 + 1 = 186 bytes
- **UserAccount**: 32 + 1 + 8 + (4 + 10*(1+32)) + 1 = 376 bytes (with 10 max bonds)
- **Bond**: 32 + 1 + 8 + 8 + 8 + 1 = 58 bytes

### Potential Expansions

- Compressed NFTs for bonds (via Metaplex Bubblegum) for cheaper minting.
- DAO integration (e.g., Realms) for config control.
- Off-chain: Indexer for user dashboards (Helius/The Graph).