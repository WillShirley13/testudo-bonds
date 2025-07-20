# Product Overview

Testudo Bonds is a Solana-based sustainable bond rewards protocol. Users deposit 10 NATIVE tokens to mint bonds that emit constant daily rewards (0.055 tokens/day) with a maximum cap of 20 tokens per bond. The protocol implements a 5% penalty for claims within 5 days of the last claim to encourage longer holding periods.

## Key Features

- **Bond System**: PDA-based bonds with deterministic addresses
- **Reward Mechanics**: Pro-rata per-second emissions with maximum caps
- **Token Economics**: 40% rewards pool, 40% treasury, 20% team split on deposits
- **Penalty System**: 5% penalty for early claims (within 5 days)
- **Multi-bond Support**: Up to 10 bonds per wallet by default

## Token Details

- **NATIVE Token**: SPL token with 9 decimals
- **Fixed Supply**: 1,000,000 tokens total
- **Program ID**: `AV5obcm5Yavs4EebSrmonAAy2K83NZZK88gUn77wmK2`

## Core Mechanics

Bonds automatically deactivate after reaching the 20-token emission cap. The system uses on-chain calculations to minimize storage costs while maintaining precision through lamport-level accounting.