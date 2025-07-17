use borsh::{BorshDeserialize, BorshSerialize};
use shank::{ShankContext, ShankInstruction};
use solana_program::pubkey::Pubkey;

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
    #[account(0, writable, name="user_account", desc = "The program derived address of the user account to create (seeds: ['user_account', wallet_pubkey, program_id])")]
    #[account(1, signer, name="user_wallet", desc = "The wallet of the user")]
    #[account(2, name="system_program", desc = "The system program")]
    CreateUser,

    /// Creates a new bond account.
    #[account(0, writable, name="bond", desc = "The program derived address of the bond account to create (seeds: ['bond', user_account, bond_index, program_id])")]
    #[account(1, signer, name="user_wallet", desc = "The wallet of the user")]
    #[account(2, name="user_account", desc = "The user's pda")]
    #[account(3, name="global_admin", desc = "The global admin account")]
    #[account(4, name="rewards_pool_ata", desc = "The rewards pool (token account) of the global admin")]
    #[account(5, name="treasury_ata", desc = "The token account of the treasury")]
    #[account(6, name="team_ata", desc = "The token account of the team")]
    #[account(7, name="native_token_mint", desc = "The native token mint")]
    #[account(8, name="token_program", desc = "The token program")]
    #[account(9, name="system_program", desc = "The system program")]
    InitializeBond,

    /// Claims rewards from a bond.
    #[account(0, writable, name="bond", desc = "The program derived address of the bond account to claim rewards from (seeds: ['bond', user_account, bond_index, program_id])")]
    #[account(1, signer, name="user_wallet", desc = "The wallet of the user")]
    #[account(2, name="user_account", desc = "The user's pda")]
    #[account(3, name="global_admin", desc = "The global admin account")]
    #[account(4, name="rewards_pool_ata", desc = "The rewards pool (token account) of the global admin")]
    #[account(5, name="native_token_mint", desc = "The native token mint")]
    #[account(6, name="token_program", desc = "The token program")]
    #[account(7, name="associated_token_program", desc = "The associated token program (for the rewards pool)")]
    #[account(8, name="system_program", desc = "The system program")]
    ProcessClaim {
        bond_index: u8,
    }
}

#[derive(BorshDeserialize, BorshSerialize, Clone, Debug)]
pub struct ProcessClaimPayload {
    pub bond_index: u8,
}
