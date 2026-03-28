#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProgramError {
    InvalidInstruction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Instruction {
    CreateLaunch,
    Contribute,
    ClaimTokens,
}

impl Instruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        match input.first().copied() {
            Some(0) => Ok(Self::CreateLaunch),
            Some(1) => Ok(Self::Contribute),
            Some(2) => Ok(Self::ClaimTokens),
            _ => Err(ProgramError::InvalidInstruction),
        }
    }
}

pub fn process_instruction(input: &[u8]) -> Result<&'static str, ProgramError> {
    match Instruction::unpack(input)? {
        Instruction::CreateLaunch => Ok("create_launch"),
        Instruction::Contribute => Ok("contribute"),
        Instruction::ClaimTokens => Ok("claim_tokens"),
    }
}

#[cfg(test)]
mod tests {
    use super::{process_instruction, Instruction, ProgramError};

    #[test]
    fn unpacks_launchpad_instructions() {
        assert_eq!(Instruction::unpack(&[0]), Ok(Instruction::CreateLaunch));
        assert_eq!(Instruction::unpack(&[1]), Ok(Instruction::Contribute));
        assert_eq!(Instruction::unpack(&[2]), Ok(Instruction::ClaimTokens));
    }

    #[test]
    fn rejects_unknown_instruction() {
        assert_eq!(Instruction::unpack(&[9]), Err(ProgramError::InvalidInstruction));
    }

    #[test]
    fn processes_claims() {
        assert_eq!(process_instruction(&[2]), Ok("claim_tokens"));
    }
}
