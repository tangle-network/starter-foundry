#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProgramError {
    InvalidInstruction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Instruction {
    InitializePool,
    AddLiquidity,
    Swap,
}

impl Instruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        match input.first().copied() {
            Some(0) => Ok(Self::InitializePool),
            Some(1) => Ok(Self::AddLiquidity),
            Some(2) => Ok(Self::Swap),
            _ => Err(ProgramError::InvalidInstruction),
        }
    }
}

pub fn process_instruction(input: &[u8]) -> Result<&'static str, ProgramError> {
    match Instruction::unpack(input)? {
        Instruction::InitializePool => Ok("initialize_pool"),
        Instruction::AddLiquidity => Ok("add_liquidity"),
        Instruction::Swap => Ok("swap"),
    }
}

#[cfg(test)]
mod tests {
    use super::{process_instruction, Instruction, ProgramError};

    #[test]
    fn unpacks_pool_instructions() {
        assert_eq!(Instruction::unpack(&[0]), Ok(Instruction::InitializePool));
        assert_eq!(Instruction::unpack(&[1]), Ok(Instruction::AddLiquidity));
        assert_eq!(Instruction::unpack(&[2]), Ok(Instruction::Swap));
    }

    #[test]
    fn rejects_unknown_instruction() {
        assert_eq!(Instruction::unpack(&[9]), Err(ProgramError::InvalidInstruction));
    }

    #[test]
    fn processes_swap() {
        assert_eq!(process_instruction(&[2]), Ok("swap"));
    }
}
