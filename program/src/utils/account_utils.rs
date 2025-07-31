use crate::error::TestudoBondsError;
use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    program::{invoke, invoke_signed},
    program_error::ProgramError,
    pubkey::Pubkey,
    rent::Rent,
    system_program::ID as system_program_id,
    sysvar::Sysvar,
};
use solana_system_interface::instruction;

/// Create a new account from the given size.
#[inline(always)]
pub fn create_account<'a>(
    target_account: &AccountInfo<'a>,
    funding_account: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    size: usize,
    owner: &Pubkey,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> ProgramResult {
    let rent = Rent::get()?;
    let lamports: u64 = rent.minimum_balance(size);

    invoke_signed(
        &instruction::create_account(
            funding_account.key,
            target_account.key,
            lamports,
            size as u64,
            owner,
        ),
        &[
            funding_account.clone(),
            target_account.clone(),
            system_program.clone(),
        ],
        signer_seeds.unwrap_or(&[]),
    )
}

/// Resize an account using realloc, lifted from Solana Cookbook.
#[inline(always)]
pub fn realloc_account<'a>(
    target_account: &AccountInfo<'a>,
    funding_account: &AccountInfo<'a>,
    system_program: &AccountInfo<'a>,
    new_size: usize,
    refund: bool,
) -> ProgramResult {
    let rent = Rent::get()?;
    let old_minimum_balance =
        rent.minimum_balance(target_account.data_len());
    let new_minimum_balance = rent.minimum_balance(new_size);
    let lamports_diff =
        new_minimum_balance.abs_diff(old_minimum_balance);

    if new_minimum_balance > old_minimum_balance {
        invoke(
            &instruction::transfer(
                funding_account.key,
                target_account.key,
                lamports_diff,
            ),
            &[
                funding_account.clone(),
                target_account.clone(),
                system_program.clone(),
            ],
        )?;
    } else if refund {
        transfer_lamports_from_pdas(
            target_account,
            funding_account,
            lamports_diff,
        )?;
    }

    target_account.resize(new_size)
}

/// Close an account.
#[inline(always)]
pub fn close_account<'a>(
    target_account: &AccountInfo<'a>,
    receiving_account: &AccountInfo<'a>,
) -> ProgramResult {
    let dest_starting_lamports = receiving_account.lamports();
    **receiving_account.lamports.borrow_mut() =
        dest_starting_lamports
            .checked_add(target_account.lamports())
            .unwrap();
    **target_account.lamports.borrow_mut() = 0;

    target_account.assign(&system_program_id);
    target_account.resize(0)
}

/// Transfer lamports.
#[inline(always)]
pub fn transfer_lamports<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    lamports: u64,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> ProgramResult {
    invoke_signed(
        &instruction::transfer(from.key, to.key, lamports),
        &[from.clone(), to.clone()],
        signer_seeds.unwrap_or(&[]),
    )
}

pub fn transfer_lamports_from_pdas<'a>(
    from: &AccountInfo<'a>,
    to: &AccountInfo<'a>,
    lamports: u64,
) -> ProgramResult {
    **from.lamports.borrow_mut() = from
        .lamports()
        .checked_sub(lamports)
        .ok_or::<ProgramError>(
            TestudoBondsError::NumericalOverflow.into(),
        )?;

    **to.lamports.borrow_mut() =
        to.lamports().checked_add(lamports).ok_or::<ProgramError>(
            TestudoBondsError::NumericalOverflow.into(),
        )?;

    Ok(())
}
