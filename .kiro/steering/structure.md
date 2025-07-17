# Project Structure

## Root Level
- `program/` - Main Solana program source code
- `clients/` - Generated client libraries (JS and Rust)
- `scripts/` - Build, test, and development automation scripts
- `ARCHITECTURE.md` - Detailed technical architecture documentation
- `Cargo.toml` - Workspace configuration for Rust projects

## Program Structure (`program/`)
```
program/
├── src/
│   ├── lib.rs          # Program entry point and exports
│   ├── entrypoint.rs   # Solana program entrypoint
│   ├── processor.rs    # Main instruction processing logic
│   ├── instruction.rs  # Instruction definitions and parsing
│   ├── state.rs        # Account state structures and PDAs
│   ├── error.rs        # Custom error definitions
│   ├── assertions.rs   # Validation and assertion helpers
│   └── utils.rs        # Utility functions
├── Cargo.toml          # Program dependencies and metadata
└── keypair.json        # Program keypair for deployment
```

## Client Structure (`clients/`)
- `js/` - TypeScript/JavaScript client library
- `rust/` - Rust client library
- Both clients are auto-generated from program IDL using Codama

## Scripts Organization (`scripts/`)
- `program/` - Program-specific build and test scripts
- `client/` - Client-specific scripts (format, lint, test, publish)
- `ci/` - Continuous integration scripts
- Root level scripts for common operations (validator, IDL generation)

## Key Account Types (PDAs)
- **Global Config PDA**: `["global_config", program_id]`
- **User PDA**: `["user", wallet_pubkey, program_id]`
- **Bond PDA**: `["bond", user_pda, bond_index, program_id]`
- **Mint Authority PDA**: `["mint_authority", program_id]`
- **Vault PDAs**: `["rewards_vault"|"treasury_vault"|"team_vault", program_id]`

## Development Workflow
1. Modify program code in `program/src/`
2. Build with `pnpm programs:build`
3. Generate IDL with `pnpm generate:idls`
4. Generate clients with `pnpm generate:clients`
5. Test with local validator using `pnpm validator:start`

## Configuration Files
- `.prettierrc` - Code formatting rules
- `rustfmt.toml` - Rust formatting configuration
- `tsconfig.json` - TypeScript configuration (in client dirs)
- Program ID and dependencies defined in `program/Cargo.toml`