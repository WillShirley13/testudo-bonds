# Technology Stack

## Core Technologies
- **Solana Program**: Native Rust program using `solana-program` crate
- **Token Standards**: SPL Token and SPL Token 2022 for NATIVE token
- **Serialization**: Borsh for account data serialization
- **IDL Generation**: Shank for generating Interface Definition Language files
- **Client Generation**: Codama for generating TypeScript and Rust clients

## Build System
- **Package Manager**: pnpm (v9.1.0+)
- **Rust Toolchain**: 1.87.0 for formatting and linting
- **Solana CLI**: v2.2.17
- **Node.js**: v20.0.0+

## Key Dependencies
- `solana-program`: 2.2.1 - Core Solana program framework
- `spl-token`: 8.0.0 - SPL token program integration
- `spl-associated-token-account`: 7.0.0 - ATA utilities
- `borsh`: 1.5.7 - Binary serialization
- `shank`: 0.4.3 - IDL generation from Rust code

## Common Commands

### Program Development
```bash
# Build all programs
pnpm programs:build

# Test programs
pnpm programs:test

# Format Rust code
pnpm programs:format

# Lint Rust code
pnpm programs:lint

# Clean build artifacts
pnpm programs:clean
```

### Client Generation
```bash
# Generate IDLs from programs
pnpm generate:idls

# Generate TypeScript and Rust clients
pnpm generate:clients

# Generate both IDLs and clients
pnpm generate
```

### Local Development
```bash
# Start local Solana validator
pnpm validator:start

# Restart validator (force restart)
pnpm validator:restart

# Stop validator
pnpm validator:stop
```

### Client Testing
```bash
# Test JavaScript client
pnpm clients:js:test

# Test Rust client
pnpm clients:rust:test
```

## Program Structure
- Uses native Solana program architecture (not Anchor)
- Modular design with separate files for instructions, state, errors, and processing
- PDA-based account management for deterministic addresses
- Event emission for off-chain tracking