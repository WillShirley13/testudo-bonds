use crate::assertions::{
    assert_empty, assert_non_empty, assert_pda, assert_same_pubkeys,
    assert_signer, assert_valid_associated_token_program,
    assert_valid_bond, assert_valid_system_program,
    assert_valid_token_account, assert_valid_token_program,
};
use crate::constants::{
    CLAIM_PENALTY, DAILY_EMISSION_RATE, MAX_EMISSION_PER_BOND,
    SHELLS_PER_TESTUDO,
};
use crate::error::TestudoBondsError;
use crate::instruction::{ProcessClaimPayload, UpdateAdminPayload};
use crate::state::{Admin, Bond, Serialization, UserAccount};
use crate::utils::{
    account_utils::{close_account, create_account},
    calculation_utils::{
        calculate_reward, calculate_token_deposit_split,
    },
    token_utils::{create_ata, transfer_spl_tokens},
};
use borsh::BorshDeserialize;
use solana_program::clock::Clock;
use solana_program::program_error::ProgramError;
use solana_program::program_pack::Pack;
use solana_program::sysvar::Sysvar;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg,
    pubkey::Pubkey,
};
use spl_token::state::Account as TokenAccount;

pub fn process_instruction<'a>(
    program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
    instruction_data: &[u8],
) -> ProgramResult {
    let (discriminator, rest) = instruction_data
        .split_first()
        .ok_or(ProgramError::InvalidInstructionData)?;
    match discriminator {
        0 => {
            msg!("Instruction: InitializeAdmin");
            initialize_admin(
                program_id,
                accounts,
                DAILY_EMISSION_RATE,
                MAX_EMISSION_PER_BOND,
                CLAIM_PENALTY,
            )
        }
        1 => {
            msg!("Instruction: InitializeUser");
            initialize_user(program_id, accounts)
        }
        2 => {
            msg!("Instruction: InitializeBond");
            initialize_bond(program_id, accounts)
        }
        3 => {
            let payload: ProcessClaimPayload =
                ProcessClaimPayload::try_from_slice(rest)?;
            msg!("Instruction: ProcessClaim");
            process_claim(
                program_id,
                accounts,
                payload.bond_index,
                payload.auto_compound,
            )
        }
        4 => {
            let payload: UpdateAdminPayload =
                UpdateAdminPayload::try_from_slice(rest)?;
            msg!("Instruction: UpdateAdmin");
            update_admin_data(
                program_id,
                accounts,
                payload.new_admin_data,
            )
        }
        _ => Err(ProgramError::InvalidInstructionData),
    }
}

fn initialize_admin<'a>(
    program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
    daily_emission_rate: u64,
    max_emission_per_bond: u64,
    claim_penalty: u16,
) -> ProgramResult {
    // Extract accounts
    let [admin_pda, authority, rewards_pool_ata, treasury, treasury_ata, team, team_ata, native_token_mint, system_program, token_program, associated_token_program] =
        &accounts
    else {
        return Err(solana_program::program_error::ProgramError::NotEnoughAccountKeys);
    };

    // Validate PDAs and account states
    let admin_bump: u8 = assert_pda(
        "Admin PDA",
        admin_pda,
        program_id,
        &[b"global_admin"],
    )?;
    assert_empty("Global admin", admin_pda)?;

    // Validate program accounts
    assert_valid_system_program(system_program.key)?;
    assert_valid_token_program(token_program.key)?;
    assert_valid_associated_token_program(
        associated_token_program.key,
    )?;

    // Validate signers
    assert_signer("Authority", authority)?;

    // Create admin account
    create_account(
        admin_pda,
        authority,
        system_program,
        Admin::SIZE,
        program_id,
        Some(&[&[b"global_admin", &[admin_bump]]]),
    )?;

    // Initialize admin data
    let admin_data: Admin = Admin {
        authority: *authority.key,
        treasury: *treasury_ata.key,
        team: *team_ata.key,
        rewards_pool: *rewards_pool_ata.key,
        native_token_mint: *native_token_mint.key,
        daily_emission_rate,
        max_emission_per_bond,
        max_bonds_per_wallet: 10,
        token_deposit_split: [4000, 4000, 2000], // [rewards pool, treasury, team]
        claim_penalty,
        pause_bond_operations: false,
    };

    admin_data.serialize_account_data(admin_pda)?;

    // Create associated token accounts if they don't exist
    if treasury_ata.data_len() != TokenAccount::LEN {
        create_ata(
            authority,
            system_program,
            token_program,
            native_token_mint,
            treasury,
            treasury_ata,
            None,
        )?;
    }

    if team_ata.data_len() != TokenAccount::LEN {
        create_ata(
            authority,
            system_program,
            token_program,
            native_token_mint,
            team,
            team_ata,
            None,
        )?;
    }

    if rewards_pool_ata.data_len() != TokenAccount::LEN {
        create_ata(
            authority,
            system_program,
            token_program,
            native_token_mint,
            admin_pda,
            rewards_pool_ata,
            Some(&[&[b"global_admin", &[admin_bump]]]),
        )?;
    }

    Ok(())
}

pub fn update_admin_data<'a>(
    program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
    new_admin_data: Admin,
) -> ProgramResult {
    // Extract accounts
    let [admin_pda, authority] = &accounts else {
        return Err(solana_program::program_error::ProgramError::NotEnoughAccountKeys);
    };

    // Validate PDAs and account states
    assert_pda(
        "Admin PDA",
        admin_pda,
        program_id,
        &[b"global_admin"],
    )?;
    assert_non_empty("Admin PDA", admin_pda)?;

    // Validate signers
    assert_signer("Authority", authority)?;

    // Get admin data
    let admin_data = Admin::deserialize_account_data(
        admin_pda.data.borrow_mut().as_ref(),
    )?;

    // Assert valid authority
    assert_same_pubkeys(
        "Authority",
        authority,
        &admin_data.authority,
    )?;

    // Update admin data
    new_admin_data.serialize_account_data(admin_pda)?;

    Ok(())
}

fn initialize_user<'a>(
    program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
) -> ProgramResult {
    // Extract accounts
    let [user_pda, user_wallet, system_program] = &accounts else {
        return Err(solana_program::program_error::ProgramError::NotEnoughAccountKeys);
    };

    // Validate PDAs and account states
    let bump = assert_pda(
        "User PDA",
        user_pda,
        program_id,
        &[b"user", user_wallet.key.as_ref()],
    )?;
    assert_empty("User PDA", user_pda)?;

    // Validate program accounts
    assert_valid_system_program(system_program.key)?;

    // Create user account
    create_account(
        user_pda,
        user_wallet,
        system_program,
        UserAccount::SIZE,
        program_id,
        Some(&[&[b"user", user_wallet.key.as_ref(), &[bump]]]),
    )?;

    // Initialize user data
    let user_pda_data: UserAccount = UserAccount {
        user: *user_wallet.key,
        bond_count: 0,
        total_accrued_rewards: 0,
        active_bonds: Vec::new(),
        bond_index: 0,
    };
    user_pda_data.serialize_account_data(user_pda)?;

    Ok(())
}

fn initialize_bond<'a>(
    program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
) -> ProgramResult {
    // Extract accounts
    let [bond_pda, user_wallet, user_pda, global_admin, user_wallet_ata, rewards_pool_ata, treasury_ata, team_ata, native_token_mint, system_program, token_program] =
        &accounts
    else {
        return Err(solana_program::program_error::ProgramError::NotEnoughAccountKeys);
    };

    // Validate signer
    assert_signer("User Wallet", user_wallet)?;

    // Validate user PDA and load data
    assert_pda(
        "User PDA",
        user_pda,
        program_id,
        &[b"user", user_wallet.key.as_ref()],
    )?;
    assert_non_empty("User PDA ", user_pda)?;
    let mut user_pda_data = UserAccount::deserialize_account_data(
        user_pda.data.borrow_mut().as_ref(),
    )?;

    assert_same_pubkeys(
        "User PDA",
        user_wallet,
        &user_pda_data.user,
    )?;

    // Validate bond PDA and account state
    let bond_bump = assert_pda(
        "Bond PDA",
        bond_pda,
        program_id,
        &[
            b"bond",
            user_pda.key.as_ref(),
            &[user_pda_data.bond_index],
        ],
    )?;
    assert_empty("Bond PDA", bond_pda)?;

    // Validate global admin
    assert_pda(
        "Global Admin PDA",
        global_admin,
        program_id,
        &[b"global_admin"],
    )?;
    assert_non_empty("Global Admin PDA", global_admin)?;

    // Validate token accounts and mint
    let global_admin_data = Admin::deserialize_account_data(
        global_admin.data.borrow_mut().as_ref(),
    )?;
    assert_same_pubkeys(
        "Rewards Pool ATA",
        rewards_pool_ata,
        &global_admin_data.rewards_pool,
    )?;
    assert_same_pubkeys(
        "Treasury ATA",
        treasury_ata,
        &global_admin_data.treasury,
    )?;
    assert_same_pubkeys(
        "Team ATA",
        team_ata,
        &global_admin_data.team,
    )?;
    assert_same_pubkeys(
        "Native Token Mint",
        native_token_mint,
        &global_admin_data.native_token_mint,
    )?;
    assert_valid_token_account(
        "User Wallet ATA",
        user_wallet_ata.key,
        native_token_mint.key,
        user_wallet_ata,
    )?;

    // Assert Admin has not paused bond operations
    if global_admin_data.pause_bond_operations {
        return Err(TestudoBondsError::BondOperationsPaused.into());
    }

    // Validate program accounts
    assert_valid_system_program(system_program.key)?;
    assert_valid_token_program(token_program.key)?;

    // Transfer tokens from User to reward_pool, treasury & team
    let token_deposit_split: [u16; 3] =
        global_admin_data.token_deposit_split;
    let user_balance = TokenAccount::unpack(
        user_wallet_ata.data.borrow_mut().as_ref(),
    )?;
    let user_balance_amount = user_balance.amount;

    // Assert User has not reached max bonds
    if user_pda_data.bond_count
        >= global_admin_data.max_bonds_per_wallet
    {
        return Err(TestudoBondsError::MaxBondsReached.into());
    }

    // Assert User has enough tokens
    if user_balance_amount < (SHELLS_PER_TESTUDO * 10) {
        return Err(TestudoBondsError::InsufficientTokens.into());
    }

    // Calculate token deposit split
    let token_deposit_split =
        calculate_token_deposit_split(token_deposit_split);

    // Transfer tokens from User to reward_pool
    transfer_spl_tokens(
        token_program,
        user_wallet_ata,
        native_token_mint,
        rewards_pool_ata,
        user_wallet,
        token_deposit_split[0],
        9,
        None,
    )?;

    // Transfer tokens from User to treasury
    transfer_spl_tokens(
        token_program,
        user_wallet_ata,
        native_token_mint,
        treasury_ata,
        user_wallet,
        token_deposit_split[1],
        9,
        None,
    )?;

    // Transfer tokens from User to team
    transfer_spl_tokens(
        token_program,
        user_wallet_ata,
        native_token_mint,
        team_ata,
        user_wallet,
        token_deposit_split[2],
        9,
        None,
    )?;

    // Create bond account
    create_account(
        bond_pda,
        user_wallet,
        system_program,
        Bond::SIZE,
        program_id,
        Some(&[&[
            b"bond",
            user_pda.key.as_ref(),
            &[user_pda_data.bond_index],
            &[bond_bump],
        ]]),
    )?;

    // Initialize bond data with current timestamp
    let timestamp: i64 = Clock::get()?.unix_timestamp;
    let bond_pda_data: Bond = Bond {
        owner: *user_pda.key,
        bond_index: user_pda_data.bond_index,
        creation_timestamp: timestamp,
        last_claim_timestamp: timestamp,
        total_claimed: 0,
        // accrued_rewards: 0,
        is_active: true,
    };
    bond_pda_data.serialize_account_data(bond_pda)?;

    // Update user data with new bond
    user_pda_data
        .active_bonds
        .push((user_pda_data.bond_index, *bond_pda.key));
    user_pda_data.bond_index += 1;
    user_pda_data.bond_count += 1;
    user_pda_data.serialize_account_data(user_pda)?;

    Ok(())
}

pub fn process_claim<'a>(
    program_id: &Pubkey,
    accounts: &'a [AccountInfo<'a>],
    bond_index: u8,
    auto_compound: bool,
) -> ProgramResult {
    // Extract accounts
    let [bond_pda, user_wallet, user_pda, user_wallet_ata, global_admin, rewards_pool_ata, treasury_ata, team_ata, new_bond_pda, native_token_mint, token_program, associated_token_program, system_program] =
        &accounts
    else {
        return Err(solana_program::program_error::ProgramError::NotEnoughAccountKeys);
    };

    // Validate PDAs
    assert_pda(
        "User PDA",
        user_pda,
        program_id,
        &[b"user", user_wallet.key.as_ref()],
    )?;
    assert_non_empty("User PDA", user_pda)?;
    let global_admin_bump: u8 = assert_pda(
        "Global Admin PDA",
        global_admin,
        program_id,
        &[b"global_admin"],
    )?;
    assert_non_empty("Global Admin PDA", global_admin)?;
    assert_pda(
        "Bond PDA",
        bond_pda,
        program_id,
        &[b"bond", user_pda.key.as_ref(), &[bond_index]],
    )?;
    assert_non_empty("Bond PDA", bond_pda)?;

    // Load account data
    let mut bond_pda_data = Bond::deserialize_account_data(
        bond_pda.data.borrow_mut().as_ref(),
    )?;
    let mut user_pda_data = UserAccount::deserialize_account_data(
        user_pda.data.borrow_mut().as_ref(),
    )?;
    let global_admin_data = Admin::deserialize_account_data(
        global_admin.data.borrow_mut().as_ref(),
    )?;

    // Assert Admin has not paused bond operations
    if global_admin_data.pause_bond_operations {
        return Err(TestudoBondsError::BondOperationsPaused.into());
    }

    // Validate account relationships
    assert_same_pubkeys(
        "User PDA",
        user_wallet,
        &user_pda_data.user,
    )?;
    assert_same_pubkeys("Bond PDA", user_pda, &bond_pda_data.owner)?;
    assert_same_pubkeys(
        "Native mint",
        native_token_mint,
        &global_admin_data.native_token_mint,
    )?;
    assert_same_pubkeys(
        "Treasury ATA",
        treasury_ata,
        &global_admin_data.treasury,
    )?;
    assert_same_pubkeys(
        "Team ATA",
        team_ata,
        &global_admin_data.team,
    )?;
    assert_valid_token_account(
        "User Wallet ATA",
        user_wallet.key,
        native_token_mint.key,
        user_wallet_ata,
    )?;

    // Validate bond index exists in user's active bonds
    if !user_pda_data
        .active_bonds
        .iter()
        .any(|(index, _)| *index == bond_index)
    {
        return Err(TestudoBondsError::InvalidBondIndex.into());
    }
    // Validate bond state
    assert_valid_bond(&bond_pda_data, &user_pda_data)?;

    // Validate program accounts
    assert_valid_system_program(system_program.key)?;
    assert_valid_token_program(token_program.key)?;
    assert_valid_associated_token_program(
        associated_token_program.key,
    )?;

    // Validate signer
    assert_signer("User Wallet", user_wallet)?;

    // Calculate rewards
    let current_timestamp = Clock::get()?.unix_timestamp;
    let mut reward = calculate_reward(
        &bond_pda_data.last_claim_timestamp,
        &current_timestamp,
        global_admin_data.daily_emission_rate,
        global_admin_data.claim_penalty,
        global_admin_data.max_emission_per_bond,
        bond_pda_data.total_claimed,
    )?;

    let reward_pool_balance = TokenAccount::unpack(
        rewards_pool_ata.data.borrow().as_ref(),
    )?
    .amount;

    if reward_pool_balance < reward {
        msg!("Insufficient rewards");
        return Err(TestudoBondsError::InsufficientRewards.into());
    }

    let should_close_bond = bond_pda_data.total_claimed + reward
        >= global_admin_data.max_emission_per_bond;

    if should_close_bond {
        reward = global_admin_data.max_emission_per_bond
            - bond_pda_data.total_claimed;
        bond_pda_data.is_active = false;
        user_pda_data
            .active_bonds
            .retain(|(index, _)| *index != bond_index);
        user_pda_data.bond_count -= 1;
    }

    // Auto-compound logic
    let mut amount_to_transfer = reward;

    if auto_compound
        && reward >= SHELLS_PER_TESTUDO * 8
        && user_pda_data.bond_count
            < global_admin_data.max_bonds_per_wallet
    {
        // 1. create the new bond PDA
        let new_bond_bump = assert_pda(
            "New Bond PDA",
            new_bond_pda,
            program_id,
            &[
                b"bond",
                user_pda.key.as_ref(),
                &[user_pda_data.bond_index],
            ],
        )?;
        assert_empty("New Bond PDA", new_bond_pda)?;

        create_account(
            new_bond_pda,
            user_wallet,
            system_program,
            Bond::SIZE,
            program_id,
            Some(&[&[
                b"bond",
                user_pda.key.as_ref(),
                &[user_pda_data.bond_index],
                &[new_bond_bump],
            ]]),
        )?;

        let new_bond_pda_data: Bond = Bond {
            owner: *user_pda.key,
            bond_index: user_pda_data.bond_index,
            creation_timestamp: current_timestamp,
            last_claim_timestamp: current_timestamp,
            total_claimed: 0,
            is_active: true,
        };
        new_bond_pda_data.serialize_account_data(new_bond_pda)?;

        user_pda_data
            .active_bonds
            .push((user_pda_data.bond_index, *new_bond_pda.key));
        user_pda_data.bond_index += 1;
        user_pda_data.bond_count += 1;

        // 2. split the 10-token deposit out of the rewards pool
        let base_amount = SHELLS_PER_TESTUDO * 8;
        let token_deposit_split = [
            (base_amount
                * global_admin_data.token_deposit_split[0] as u64)
                / 10_000,
            (base_amount
                * global_admin_data.token_deposit_split[1] as u64)
                / 10_000,
            (base_amount
                * global_admin_data.token_deposit_split[2] as u64)
                / 10_000,
        ];

        // pool share stays in rewards_pool_ata (split[0])
        transfer_spl_tokens(
            token_program,
            rewards_pool_ata,
            native_token_mint,
            treasury_ata,
            global_admin,
            token_deposit_split[1],
            9,
            Some(&[&[b"global_admin", &[global_admin_bump]]]),
        )?;

        transfer_spl_tokens(
            token_program,
            rewards_pool_ata,
            native_token_mint,
            team_ata,
            global_admin,
            token_deposit_split[2],
            9,
            Some(&[&[b"global_admin", &[global_admin_bump]]]),
        )?;

        // 3. Reduce the amount we will send to the user.
        amount_to_transfer -= SHELLS_PER_TESTUDO * 8;
    }

    // Transfer remaining rewards to the user if any
    if amount_to_transfer > 0 {
        transfer_spl_tokens(
            token_program,
            rewards_pool_ata,
            native_token_mint,
            user_wallet_ata,
            global_admin,
            amount_to_transfer,
            9,
            Some(&[&[b"global_admin", &[global_admin_bump]]]),
        )?;
    }

    bond_pda_data.last_claim_timestamp = current_timestamp;
    bond_pda_data.total_claimed += reward;

    if should_close_bond {
        close_account(bond_pda, user_wallet)?;
    } else {
        bond_pda_data.serialize_account_data(bond_pda)?;
    }

    user_pda_data.total_accrued_rewards += reward;
    user_pda_data.serialize_account_data(user_pda)?;

    Ok(())
}
