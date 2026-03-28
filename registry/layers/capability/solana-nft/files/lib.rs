#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProgramError {
    InvalidInstruction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Instruction {
    CreateListing,
    AcceptOffer,
    SettleAuction,
}

impl Instruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        match input.first().copied() {
            Some(0) => Ok(Self::CreateListing),
            Some(1) => Ok(Self::AcceptOffer),
            Some(2) => Ok(Self::SettleAuction),
            _ => Err(ProgramError::InvalidInstruction),
        }
    }
}

pub fn process_instruction(input: &[u8]) -> Result<&'static str, ProgramError> {
    match Instruction::unpack(input)? {
        Instruction::CreateListing => Ok("create_listing"),
        Instruction::AcceptOffer => Ok("accept_offer"),
        Instruction::SettleAuction => Ok("settle_auction"),
    }
}

#[cfg(test)]
mod tests {
    use super::{process_instruction, Instruction, ProgramError};

    #[test]
    fn unpacks_marketplace_instructions() {
        assert_eq!(Instruction::unpack(&[0]), Ok(Instruction::CreateListing));
        assert_eq!(Instruction::unpack(&[1]), Ok(Instruction::AcceptOffer));
        assert_eq!(Instruction::unpack(&[2]), Ok(Instruction::SettleAuction));
    }

    #[test]
    fn rejects_unknown_instruction() {
        assert_eq!(Instruction::unpack(&[9]), Err(ProgramError::InvalidInstruction));
    }

    #[test]
    fn processes_listing_creation() {
        assert_eq!(process_instruction(&[0]), Ok("create_listing"));
    }
}
