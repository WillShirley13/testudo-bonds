use crate::error::TestudoBondsError;
use crate::state::Bond;
use solana_program::program_pack::Pack;
use solana_program::system_program::ID as system_program;
use solana_program::{
    account_info::AccountInfo, entrypoint::ProgramResult, msg, program_error::ProgramError,
    pubkey::Pubkey,
};
use spl_associated_token_account::ID as associated_token_program;
use spl_token::state::Account as TokenAccount;
use spl_token::ID as token_program;
use spl_token_2022::ID as token_2022_program;

pub fn assert_valid_system_program(program_id: &Pubkey) -> ProgramResult {
    if program_id.ne(&system_program) {
        return Err(ProgramError::IncorrectProgramId);
    }
    Ok(())
}

pub fn assert_valid_token_program(program_id: &Pubkey) -> ProgramResult {
    if program_id.ne(&token_program) && program_id.ne(&token_2022_program) {
        return Err(ProgramError::IncorrectProgramId);
    }
    Ok(())
}

pub fn assert_valid_associated_token_program(program_id: &Pubkey) -> ProgramResult {
    if program_id.ne(&associated_token_program) {
        return Err(ProgramError::IncorrectProgramId);
    }
    Ok(())
}

/// Assert that the given account is owned by the given program or one of the given owners.
/// Useful for dealing with program interfaces.
pub fn assert_program_owner_either(
    account_name: &str,
    account: &AccountInfo,
    owners: &[Pubkey],
) -> ProgramResult {
    if !owners.iter().any(|owner| account.owner == owner) {
        msg!(
            "Account \"{}\" [{}] must be owned by either {:?}",
            account_name,
            account.key,
            owners
        );
        Err(TestudoBondsError::InvalidProgramOwner.into())
    } else {
        Ok(())
    }
}

/// Assert that the given account is owned by the given program.
pub fn assert_program_owner(
    account_name: &str,
    account: &AccountInfo,
    owner: &Pubkey,
) -> ProgramResult {
    if account.owner != owner {
        msg!(
            "Account \"{}\" [{}] expected program owner [{}], got [{}]",
            account_name,
            account.key,
            owner,
            account.owner
        );
        Err(TestudoBondsError::InvalidProgramOwner.into())
    } else {
        Ok(())
    }
}

/// Assert the derivation of the seeds against the given account and return the bump seed.
pub fn assert_pda(
    account_name: &str,
    account: &AccountInfo,
    program_id: &Pubkey,
    seeds: &[&[u8]],
) -> Result<u8, ProgramError> {
    let (key, bump) = Pubkey::find_program_address(seeds, program_id);
    if *account.key != key {
        msg!(
            "Account \"{}\" [{}] is an invalid PDA. Expected the following valid PDA [{}]",
            account_name,
            account.key,
            key,
        );
        return Err(TestudoBondsError::InvalidPda.into());
    }
    Ok(bump)
}

/// Assert the derivation of the seeds plus bump against the given account.
pub fn assert_pda_with_bump(
    account_name: &str,
    account: &AccountInfo,
    program_id: &Pubkey,
    seeds_with_bump: &[&[u8]],
) -> ProgramResult {
    let key = Pubkey::create_program_address(seeds_with_bump, program_id)?;
    if *account.key != key {
        msg!(
            "Account \"{}\" [{}] is an invalid PDA. Expected the following valid PDA [{}]",
            account_name,
            account.key,
            key,
        );
        Err(TestudoBondsError::InvalidPda.into())
    } else {
        Ok(())
    }
}

/// Assert that the given account is empty.
pub fn assert_empty(account_name: &str, account: &AccountInfo) -> ProgramResult {
    if !account.data_is_empty() {
        msg!(
            "Account \"{}\" [{}] must be empty",
            account_name,
            account.key,
        );
        Err(TestudoBondsError::ExpectedEmptyAccount.into())
    } else {
        Ok(())
    }
}

/// Assert that the given account is non empty.
pub fn assert_non_empty(account_name: &str, account: &AccountInfo) -> ProgramResult {
    if account.data_is_empty() {
        msg!(
            "Account \"{}\" [{}] must not be empty",
            account_name,
            account.key,
        );
        Err(TestudoBondsError::ExpectedNonEmptyAccount.into())
    } else {
        Ok(())
    }
}

/// Assert that the given account is a signer.
pub fn assert_signer(account_name: &str, account: &AccountInfo) -> ProgramResult {
    if !account.is_signer {
        msg!(
            "Account \"{}\" [{}] must be a signer",
            account_name,
            account.key,
        );
        Err(TestudoBondsError::ExpectedSignerAccount.into())
    } else {
        Ok(())
    }
}

/// Assert that the given account is writable.
pub fn assert_writable(account_name: &str, account: &AccountInfo) -> ProgramResult {
    if !account.is_writable {
        msg!(
            "Account \"{}\" [{}] must be writable",
            account_name,
            account.key,
        );
        Err(TestudoBondsError::ExpectedWritableAccount.into())
    } else {
        Ok(())
    }
}

/// Assert that the given account matches the given public key.
pub fn assert_same_pubkeys(
    account_name: &str,
    account: &AccountInfo,
    expected: &Pubkey,
) -> ProgramResult {
    if account.key != expected {
        msg!(
            "Account \"{}\" [{}] must match the following public key [{}]",
            account_name,
            account.key,
            expected
        );
        Err(TestudoBondsError::AccountMismatch.into())
    } else {
        Ok(())
    }
}

/// Assert that the given account has the expected account key.
pub fn assert_account_key(account_name: &str, account: &AccountInfo, key: u8) -> ProgramResult {
    let key_number = key;
    if account.data_len() <= 1 || account.try_borrow_data()?[0] != key_number {
        msg!(
            "Account \"{}\" [{}] expected account key [{}], got [{}]",
            account_name,
            account.key,
            key_number,
            account.try_borrow_data()?[0]
        );
        Err(TestudoBondsError::InvalidAccountKey.into())
    } else {
        Ok(())
    }
}

pub fn assert_sufficient_tokens(
    user_native_ata: &AccountInfo,
    required_amount: u64,
) -> ProgramResult {
    let token_account_data = TokenAccount::unpack(&user_native_ata.data.borrow())?;
    if token_account_data.amount < required_amount {
        msg!(
            "User native ata data amount [{}] is less than the required amount [{}]",
            token_account_data.amount,
            required_amount
        );
        Err(TestudoBondsError::InsufficientTokens.into())
    } else {
        Ok(())
    }
}

pub fn assert_valid_bond(bond_pda_data: &Bond, user_pda_data: &UserAccount) -> ProgramResult {
    if !bond_pda_data.is_active {
        msg!("Bond is not active");
        Err(TestudoBondsError::BondNotActive.into())
    } else if !user_pda_data
        .active_bonds
        .iter()
        .any(|(index, _)| *index == bond_pda_data.bond_index)
    {
        msg!("Bond index [{}] is invalid", bond_pda_data.bond_index);
        Err(TestudoBondsError::InvalidBondIndex.into())
    } else {
        Ok(())
    }
}
