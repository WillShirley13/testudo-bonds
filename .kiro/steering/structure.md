# Project Structure

## Root Level Organization

```
testudo-bonds/
├── program/           # Solana program (Rust)
├── clients/           # Generated client libraries
│   ├── js/           # JavaScript/TypeScript client
│   └── rust/         # Rust client
├── scripts/          # Build and development scripts
├── .kiro/            # Kiro configuration and steering
└── target/           # Rust build artifacts
```

## Program Structure (`program/`)

```
program/src/
├── lib.rs            # Program entry point and module declarations
├── entrypoint.rs     # Solana program entrypoint
├── processor.rs      # Instruction processing logic
├── instruction.rs    # Instruction definitions
├── state.rs          # Account state structures (Admin, UserAccount, Bond)
├── error.rs          # Custom error types
├── constants.rs      # Program constants
├── assertions.rs     # Validation utilities
└── utils/            # Utility modules
    ├── mod.rs
    ├── account_utils.rs
    ├── calculation_utils.rs
    └── token_utils.rs
```

## Key Account Types

### State Accounts (PDAs)
- **Global Admin PDA**: `["global_admin"]` - Central configuration
- **User Account PDA**: `["user", wallet_pubkey]` - Per-user aggregation
- **Bond PDA**: `["bond", user_pda, bond_index]` - Individual bonds

### Token Accounts (ATAs)
- **Rewards Pool ATA**: Owned by Global Admin PDA
- **Treasury ATA**: Owned by treasury wallet
- **Team ATA**: Owned by team wallet
- **User Wallet ATA**: Owned by user wallet

## Client Structure

### JavaScript Client (`clients/js/`)
```
src/
├── index.ts          # Main exports
test/
├── _setup.ts         # Test configuration
├── create.test.ts    # Bond creation tests
└── increment.test.ts # Reward increment tests
```

### Rust Client (`clients/rust/`)
```
src/
├── lib.rs           # Client library
tests/
└── create.rs        # Integration tests
```

## Scripts Organization (`scripts/`)

```
scripts/
├── program/         # Program-specific scripts
│   ├── build.mjs   # Build programs
│   ├── test.mjs    # Test programs
│   ├── format.mjs  # Format code
│   └── lint.mjs    # Lint code
├── client/         # Client-specific scripts
└── ci/             # CI/CD utilities
```

## Configuration Files

- **Cargo.toml**: Workspace configuration with Solana CLI version
- **rustfmt.toml**: Rust formatting rules (max_width=70)
- **package.json**: NPM scripts and dependencies
- **.prettierrc**: JavaScript/TypeScript formatting

## Development Patterns

### Account Serialization
All state accounts implement the `Serialization<T>` trait with Borsh serialization.

### PDA Derivation
Consistent seed patterns:
- Global config: `["global_admin"]`
- User accounts: `["user", wallet_pubkey]`
- Bonds: `["bond", user_pda, bond_index]`

### Error Handling
Custom error types in `error.rs` with descriptive variants for validation failures.

### Modular Utilities
Utility functions organized by domain (account, calculation, token operations).