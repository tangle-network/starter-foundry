#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProgramError {
    InvalidInstruction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Instruction {
    InitializeStakePool,
    StakeTokens,
    ClaimRewards,
}

impl Instruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        match input.first().copied() {
            Some(0) => Ok(Self::InitializeStakePool),
            Some(1) => Ok(Self::StakeTokens),
            Some(2) => Ok(Self::ClaimRewards),
            _ => Err(ProgramError::InvalidInstruction),
        }
    }
}

pub fn process_instruction(input: &[u8]) -> Result<&'static str, ProgramError> {
    match Instruction::unpack(input)? {
        Instruction::InitializeStakePool => Ok("initialize_stake_pool"),
        Instruction::StakeTokens => Ok("stake_tokens"),
        Instruction::ClaimRewards => Ok("claim_rewards"),
    }
}

#[cfg(test)]
mod tests {
    use super::{process_instruction, Instruction, ProgramError};

    #[test]
    fn unpacks_staking_instructions() {
        assert_eq!(Instruction::unpack(&[0]), Ok(Instruction::InitializeStakePool));
        assert_eq!(Instruction::unpack(&[1]), Ok(Instruction::StakeTokens));
        assert_eq!(Instruction::unpack(&[2]), Ok(Instruction::ClaimRewards));
    }

    #[test]
    fn rejects_unknown_instruction() {
        assert_eq!(Instruction::unpack(&[9]), Err(ProgramError::InvalidInstruction));
    }

    #[test]
    fn processes_rewards_claims() {
        assert_eq!(process_instruction(&[2]), Ok("claim_rewards"));
    }
}
