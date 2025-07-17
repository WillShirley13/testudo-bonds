# Product Overview

Testudo Bonds is a Solana-based sustainable bond rewards system. Users deposit 10 NATIVE tokens to mint a bond (NFT-like PDA) that emits decaying rewards up to 20 tokens over 365 days.

## Core Mechanics
- **Bond Creation**: 10 NATIVE token deposit creates a bond PDA
- **Reward Distribution**: Bonds emit decaying rewards (starts at 0.09 rate, 0.99 decay factor)
- **Fund Allocation**: Deposits split 40% rewards pool, 40% treasury, 20% team
- **Bond Lifecycle**: Bonds "die" after reaching 20 token cap or 365 days
- **Token Economics**: Fixed 1M NATIVE supply with 9 decimals

## Key Features
- Deterministic PDA-based architecture for cost efficiency
- On-the-fly reward calculations to minimize storage
- Admin controls with future DAO governance path
- Penalty system for early claims (7-day threshold, 5% fee)
- Treasury integration for yield generation