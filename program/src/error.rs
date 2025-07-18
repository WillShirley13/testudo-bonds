use num_derive::FromPrimitive;
use solana_program::program_error::ProgramError;
use thiserror::Error;

#[derive(Error, Clone, Debug, Eq, PartialEq, FromPrimitive)]
pub enum TestudoBondsError {
    /// 0 - Error deserializing an account
    #[error("Error deserializing an account")]
    DeserializationError,
    /// 1 - Error serializing an account
    #[error("Error serializing an account")]
    SerializationError,
    /// 2 - Invalid program owner
    #[error("Invalid program owner. This likely mean the provided account does not exist")]
    InvalidProgramOwner,
    /// 3 - Invalid PDA derivation
    #[error("Invalid PDA derivation")]
    InvalidPda,
    /// 4 - Expected empty account
    #[error("Expected empty account")]
    ExpectedEmptyAccount,
    /// 5 - Expected non empty account
    #[error("Expected non empty account")]
    ExpectedNonEmptyAccount,
    /// 6 - Expected signer account
    #[error("Expected signer account")]
    ExpectedSignerAccount,
    /// 7 - Expected writable account
    #[error("Expected writable account")]
    ExpectedWritableAccount,
    /// 8 - Account mismatch
    #[error("Account mismatch")]
    AccountMismatch,
    /// 9 - Invalid account key
    #[error("Invalid account key")]
    InvalidAccountKey,
    /// 10 - Numerical overflow
    #[error("Numerical overflow")]
    NumericalOverflow,
    /// 11 - Insufficient tokens
    #[error("Insufficient native tokens")]
    InsufficientTokens,
    /// 12 - Invalid bond index
    #[error("Invalid bond index")]
    InvalidBondIndex,
    /// 13 - Invalid token accounts
    #[error("Invalid token accounts")]
    InvalidTokenAccounts,
    /// 14 - No rewards
    #[error("No rewards to claim")]
    NoRewardsToClaim,
    /// 15 - Insufficient rewards
    #[error("Insufficient rewards")]
    InsufficientRewards,
    /// 16 - Bond not active
    #[error("Bond not active")]
    BondNotActive,
    /// 17 - Max bonds reached
    #[error("Max bonds reached")]
    MaxBondsReached,
    /// 18 - Bond operations paused
    #[error("Bond operations paused")]
    BondOperationsPaused,
    /// 19 - Bond is active
    #[error("Bond is active")]
    BondIsActive,
}

impl From<TestudoBondsError> for ProgramError {
    fn from(e: TestudoBondsError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
