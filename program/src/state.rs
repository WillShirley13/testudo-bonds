use borsh::{BorshDeserialize, BorshSerialize};
use shank::ShankAccount;
use solana_program::account_info::AccountInfo;
use solana_program::entrypoint::ProgramResult;
use solana_program::program_error::ProgramError;
use solana_program::pubkey::Pubkey;

pub trait Serialization<T> {
    fn serialize_account_data(&self, account_info: &AccountInfo) -> ProgramResult;
    fn deserialize_account_data(data: &[u8]) -> Result<T, ProgramError>;
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug, ShankAccount)]
pub struct Admin {
    pub authority: Pubkey,
    pub treasury: Pubkey,
    pub team: Pubkey,
    pub rewards_pool: Pubkey,
    pub native_token_mint: Pubkey,
    pub daily_emission_rate: u64, // used as lamports would be used. e.g. 55_000_000 (0.055 tokens in lamports)
    pub max_emission_per_bond: u64, // 20_000_000_000 (20 tokens)
    pub max_bonds_per_wallet: u8,
    pub token_deposit_split: [u16; 3], // [rewards pool, treasury, team] in basis points
    pub claim_penalty: u16,            // basis points. e.g. 500 = 5%
    pub pause_bond_operations: bool,
}

impl Admin {
    pub const SIZE: usize = 32 + 32 + 32 + 32 + 32 + 8 + 8 + 1 + (3 * 2) + 2 + 1;
}

impl Serialization<Admin> for Admin {
    fn serialize_account_data(&self, account_info: &AccountInfo) -> ProgramResult {
        self.serialize(&mut &mut account_info.data.borrow_mut()[..])?;
        Ok(())
    }

    fn deserialize_account_data(data: &[u8]) -> Result<Admin, ProgramError> {
        let data: Admin =
            Admin::try_from_slice(data).map_err(|_| ProgramError::InvalidAccountData)?;
        Ok(data)
    }
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug, ShankAccount)]
pub struct UserAccount {
    pub user: Pubkey,
    pub bond_count: u8,                  // Number of bonds the user currently has.
    pub total_accrued_rewards: u64,      // 9 decimals
    pub active_bonds: Vec<(u8, Pubkey)>, // (bond_index, bond_pda)
    pub bond_index: u8,                  // Index of the next bond to be created.
}

impl UserAccount {
    pub const SIZE: usize = 32 + 1 + 8 + (4 + (10 * (32 + 1))) + 1;
}

impl Serialization<UserAccount> for UserAccount {
    fn serialize_account_data(&self, account_info: &AccountInfo) -> ProgramResult {
        self.serialize(&mut &mut account_info.data.borrow_mut()[..])?;
        Ok(())
    }

    fn deserialize_account_data(data: &[u8]) -> Result<UserAccount, ProgramError> {
        let data: UserAccount =
            UserAccount::try_from_slice(data).map_err(|_| ProgramError::InvalidAccountData)?;
        Ok(data)
    }
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug, ShankAccount)]
pub struct Bond {
    pub owner: Pubkey,
    pub bond_index: u8,
    pub creation_timestamp: i64,
    pub last_claim_timestamp: i64,
    pub total_claimed: u64, // Total amount claimed from the bond.
    // pub accrued_rewards: u64, // Rewards that have been accrued since last claim.
    pub is_active: bool, // If the bond is active, it can be claimed.
}

impl Bond {
    pub const SIZE: usize = 32 + 1 + 8 + 8 + 8 + 1;
}

impl Serialization<Bond> for Bond {
    fn serialize_account_data(&self, account_info: &AccountInfo) -> ProgramResult {
        self.serialize(&mut &mut account_info.data.borrow_mut()[..])?;
        Ok(())
    }

    fn deserialize_account_data(data: &[u8]) -> Result<Bond, ProgramError> {
        let data: Bond =
            Bond::try_from_slice(data).map_err(|_| ProgramError::InvalidAccountData)?;
        Ok(data)
    }
}
