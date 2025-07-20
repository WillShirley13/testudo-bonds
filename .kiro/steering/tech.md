# Technology Stack

## Core Technologies

- **Solana Program**: Native Solana program written in Rust
- **IDL Generation**: Shank for generating Interface Definition Language files
- **Serialization**: Borsh for account data serialization
- **Token Standard**: SPL Token for NATIVE token implementation

## Build System & Tools

- **Package Manager**: pnpm (v9.1.0)
- **Task Runner**: zx for JavaScript build scripts
- **Rust Toolchain**: 1.87.0 for formatting and linting
- **Solana CLI**: v2.2.17

## Development Workflow

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

# Generate client libraries
pnpm generate:clients

# Generate both IDLs and clients
pnpm generate
```

### Local Development
```bash
# Start local validator
pnpm validator:start

# Restart validator (force restart)
pnpm validator:restart

# Stop validator
pnpm validator:stop
```

### Client Development
```bash
# JavaScript client
pnpm clients:js:test
pnpm clients:js:format
pnpm clients:js:lint

# Rust client
pnpm clients:rust:test
pnpm clients:rust:format
pnpm clients:rust:lint
```

## Code Style

- **Rust**: Uses rustfmt with max_width=70, import reordering enabled
- **JavaScript/TypeScript**: ESLint + Prettier configuration
- **Import Organization**: Crate-level granularity, mixed layout preferred

## Dependencies

### Program Dependencies
- `solana-program`: Core Solana program library
- `borsh`: Serialization framework
- `shank`: IDL generation
- `spl-token`: SPL token utilities
- `spl-associated-token-account`: ATA utilities

### Client Dependencies
- **JS**: `@solana/web3.js` v2.0.0, TypeScript, AVA for testing
- **Rust**: `solana-program`, `borsh`, optional `anchor-lang` support