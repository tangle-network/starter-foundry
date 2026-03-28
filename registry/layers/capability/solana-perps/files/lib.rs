#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProgramError {
    InvalidInstruction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Instruction {
    InitializePerpMarket,
    OpenPosition,
    LiquidatePosition,
}

impl Instruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        match input.first().copied() {
            Some(0) => Ok(Self::InitializePerpMarket),
            Some(1) => Ok(Self::OpenPosition),
            Some(2) => Ok(Self::LiquidatePosition),
            _ => Err(ProgramError::InvalidInstruction),
        }
    }
}

pub fn process_instruction(input: &[u8]) -> Result<&'static str, ProgramError> {
    match Instruction::unpack(input)? {
        Instruction::InitializePerpMarket => Ok("initialize_perp_market"),
        Instruction::OpenPosition => Ok("open_position"),
        Instruction::LiquidatePosition => Ok("liquidate_position"),
    }
}

#[cfg(test)]
mod tests {
    use super::{process_instruction, Instruction, ProgramError};

    #[test]
    fn unpacks_perps_instructions() {
        assert_eq!(Instruction::unpack(&[0]), Ok(Instruction::InitializePerpMarket));
        assert_eq!(Instruction::unpack(&[1]), Ok(Instruction::OpenPosition));
        assert_eq!(Instruction::unpack(&[2]), Ok(Instruction::LiquidatePosition));
    }

    #[test]
    fn rejects_unknown_instruction() {
        assert_eq!(Instruction::unpack(&[9]), Err(ProgramError::InvalidInstruction));
    }

    #[test]
    fn processes_open_position() {
        assert_eq!(process_instruction(&[1]), Ok("open_position"));
    }
}
