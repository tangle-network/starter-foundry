#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProgramError {
    InvalidInstruction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Instruction {
    CreateMarket,
    PlaceOrder,
    ResolveMarket,
}

impl Instruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        match input.first().copied() {
            Some(0) => Ok(Self::CreateMarket),
            Some(1) => Ok(Self::PlaceOrder),
            Some(2) => Ok(Self::ResolveMarket),
            _ => Err(ProgramError::InvalidInstruction),
        }
    }
}

pub fn process_instruction(input: &[u8]) -> Result<&'static str, ProgramError> {
    match Instruction::unpack(input)? {
        Instruction::CreateMarket => Ok("create_market"),
        Instruction::PlaceOrder => Ok("place_order"),
        Instruction::ResolveMarket => Ok("resolve_market"),
    }
}

#[cfg(test)]
mod tests {
    use super::{process_instruction, Instruction, ProgramError};

    #[test]
    fn unpacks_prediction_instructions() {
        assert_eq!(Instruction::unpack(&[0]), Ok(Instruction::CreateMarket));
        assert_eq!(Instruction::unpack(&[1]), Ok(Instruction::PlaceOrder));
        assert_eq!(Instruction::unpack(&[2]), Ok(Instruction::ResolveMarket));
    }

    #[test]
    fn rejects_unknown_instruction() {
        assert_eq!(Instruction::unpack(&[9]), Err(ProgramError::InvalidInstruction));
    }

    #[test]
    fn processes_market_resolution() {
        assert_eq!(process_instruction(&[2]), Ok("resolve_market"));
    }
}
