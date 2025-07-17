use solana_program::{entrypoint::ProgramResult, program_error::ProgramError};

use crate::{constants::SHELLS_PER_TESTUDO, error::TestudoBondsError};

pub fn calculate_reward(
    previous_claim_timestamp: &i64,
    current_timestamp: &i64,
    daily_emission: u64,
    claim_penalty: u16,
) -> Result<u64, ProgramError> {
    let seconds_elapsed = (current_timestamp - previous_claim_timestamp) as u64;
    let seconds_per_day = 86400u64;

    // Calculate reward based on seconds elapsed with full precision
    // Formula: (daily_emission * seconds_elapsed) / seconds_per_day
    let reward = daily_emission
        .checked_mul(seconds_elapsed)
        .and_then(|product| product.checked_div(seconds_per_day))
        .unwrap_or(0);

    if reward == 0 {
        return Err(TestudoBondsError::NoRewardsToClaim.into());
    }
    let reward_with_penalty = calculate_claim_penalty(
        previous_claim_timestamp,
        current_timestamp,
        &claim_penalty,
        &reward,
    )?;

    Ok(reward_with_penalty)
}

pub fn calculate_token_deposit_split(token_deposit_split: [u16; 3]) -> [u64; 3] {
    let base_amount = 10 * SHELLS_PER_TESTUDO;
    [
        (base_amount * token_deposit_split[0] as u64) / 10_000,
        (base_amount * token_deposit_split[1] as u64) / 10_000,
        (base_amount * token_deposit_split[2] as u64) / 10_000,
    ]
}

pub fn calculate_claim_penalty(
    previous_claim_timestamp: &i64,
    current_timestamp: &i64,
    claim_penalty: &u16,
    reward: &u64,
) -> Result<u64, ProgramError> {
    let seconds_elapsed = (current_timestamp - previous_claim_timestamp) as u64;
    let seconds_per_day = 86400u64;
    if seconds_elapsed < seconds_per_day * 5 {
        reward
            .checked_sub(reward.checked_mul(*claim_penalty as u64).unwrap() / 10_000)
            .ok_or(TestudoBondsError::NumericalOverflow.into())
    } else {
        Ok(*reward)
    }
}
