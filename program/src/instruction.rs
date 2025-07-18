use borsh::{BorshDeserialize, BorshSerialize};
use shank::{ShankContext, ShankInstruction};

use crate::state::Admin;

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug, ShankContext, ShankInstruction)]
#[rustfmt::skip]
pub enum TestudoBondsInstruction {
    /// Creates the global admin account.
    #[account(0, writable, name="global_admin", desc = "The program derived address of the global admin account to create (seeds: ['global_admin', program_id])")]
    #[account(1, signer, name="authority", desc = "The authority of the global admin")]
    #[account(2, name="rewards_pool_ata", desc = "The rewards pool (token account) of the global admin")]
    #[account(3, signer, name="treasury", desc = "The treasury account")]
    #[account(4, name="treasury_ata", desc = "The token account of the treasury")]
    #[account(5, signer, name="team", desc = "The team account")]
    #[account(6, name="team_ata", desc = "The token account of the team")]
    #[account(7, name="native_token_mint", desc = "The native token mint")]
    #[account(8, name="system_program", desc = "The system program")]
    #[account(9, name="token_program", desc = "The token program")]
    #[account(10, name="associated_token_program", desc = "The associated token program")]
    InitializeAdmin,

    /// Creates a new user account.
    #[account(0, writable, name="user_pda", desc = "The program derived address of the user account to create (seeds: ['user_pda', wallet_pubkey, program_id])")]
    #[account(1, signer, name="user_wallet", desc = "The wallet of the user")]
    #[account(2, name="system_program", desc = "The system program")]
    CreateUser,

    /// Creates a new bond account.
    #[account(0, writable, name="bond", desc = "The program derived address of the bond account to create (seeds: ['bond', user_pda, bond_index, program_id])")]
    #[account(1, signer, name="user_wallet", desc = "The wallet of the user")]
    #[account(2, name="user_pda", desc = "The user's pda")]
    #[account(3, name="global_admin", desc = "The global admin account")]
    #[account(4, name="user_wallet_ata", desc = "The user's wallet token account")]
    #[account(5, name="rewards_pool_ata", desc = "The rewards pool (token account) of the global admin")]
    #[account(6, name="treasury_ata", desc = "The token account of the treasury")]
    #[account(7, name="team_ata", desc = "The token account of the team")]
    #[account(8, name="native_token_mint", desc = "The native token mint")]
    #[account(9, name="token_program", desc = "The token program")]
    #[account(10, name="system_program", desc = "The system program")]
    InitializeBond,

    /// Claims rewards from a bond.
    #[account(0, writable, name="bond", desc = "The program derived address of the bond account to claim rewards from (seeds: ['bond', user_pda, bond_index, program_id])")]
    #[account(1, signer, name="user_wallet", desc = "The wallet of the user")]
    #[account(2, name="user_pda", desc = "The user's pda")]
    #[account(3, name="user_wallet_ata", desc = "The user's wallet token account")]
    #[account(4, name="global_admin", desc = "The global admin account")]
    #[account(5, name="rewards_pool_ata", desc = "The rewards pool (token account) of the global admin")]
    #[account(6, name="treasury_ata", desc = "The token account of the treasury")]
    #[account(7, name="team_ata", desc = "The token account of the team")]
    #[account(8, writable, name="new_bond_pda", desc = "The program derived address for the new bond to be auto-compounded (seeds: ['bond', user_pda, next_bond_index, program_id])")]
    #[account(9, name="native_token_mint", desc = "The native token mint")]
    #[account(10, name="token_program", desc = "The token program")]
    #[account(11, name="associated_token_program", desc = "The associated token program (for the rewards pool)")]
    #[account(12, name="system_program", desc = "The system program")]
    ProcessClaim {
        bond_index: u8,
        auto_compound: bool,
    },

    /// Updates the admin data.
    #[account(0, writable, name="global_admin", desc = "The program derived address of the global admin account to update (seeds: ['global_admin', program_id])")]
    #[account(1, signer, name="authority", desc = "The authority of the global admin")]
    UpdateAdmin,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug)]
pub struct ProcessClaimPayload {
    pub bond_index: u8,
    pub auto_compound: bool,
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug)]
pub struct UpdateAdminPayload {
    pub new_admin_data: Admin,
}
