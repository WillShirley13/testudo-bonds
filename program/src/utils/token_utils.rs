use solana_program::{
    account_info::AccountInfo,
    entrypoint::ProgramResult,
    program::{invoke, invoke_signed},
};
use spl_associated_token_account::instruction::create_associated_token_account;
use spl_token::instruction::transfer_checked;

pub fn create_ata<'a>(
    token_program: &'a AccountInfo<'a>,
    associated_token_program: &'a AccountInfo<'a>,
    native_token_mint: &'a AccountInfo<'a>,
    wallet: &'a AccountInfo<'a>,
    token_account: &'a AccountInfo<'a>,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> ProgramResult {
    let ix = create_associated_token_account(
        wallet.key,
        wallet.key,
        native_token_mint.key,
        token_program.key,
    );

    if let Some(signer_seeds) = signer_seeds {
        invoke_signed(
            &ix,
            &[
                token_program.clone(),
                associated_token_program.clone(),
                native_token_mint.clone(),
                wallet.clone(),
                token_account.clone(),
            ],
            signer_seeds,
        )?;
    } else {
        invoke(
            &ix,
            &[
                token_program.clone(),
                associated_token_program.clone(),
                native_token_mint.clone(),
                wallet.clone(),
                token_account.clone(),
            ],
        )?;
    }
    Ok(())
}

pub fn transfer_spl_tokens<'a>(
    token_program: &'a AccountInfo<'a>,
    source_account: &'a AccountInfo<'a>,
    mint_account: &'a AccountInfo<'a>,
    destination_account: &'a AccountInfo<'a>,
    authority_account: &'a AccountInfo<'a>,
    amount: u64,
    decimals: u8,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> ProgramResult {
    let transfer_ix = transfer_checked(
        token_program.key,
        source_account.key,
        mint_account.key,
        destination_account.key,
        authority_account.key,
        &[],
        amount,
        decimals,
    )?;

    let accounts = &[
        source_account.clone(),
        mint_account.clone(),
        destination_account.clone(),
        authority_account.clone(),
        token_program.clone(),
    ];

    if let Some(seeds) = signer_seeds {
        invoke_signed(&transfer_ix, accounts, seeds)
    } else {
        invoke(&transfer_ix, accounts)
    }
}
