#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProgramError {
    InvalidInstruction,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Instruction {
    {{instructionName}},
    RotateAuthority,
}

impl Instruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        match input.first().copied() {
            Some(0) => Ok(Self::{{instructionName}}),
            Some(1) => Ok(Self::RotateAuthority),
            _ => Err(ProgramError::InvalidInstruction),
        }
    }
}

pub fn process_instruction(input: &[u8]) -> Result<&'static str, ProgramError> {
    match Instruction::unpack(input)? {
        Instruction::{{instructionName}} => Ok("initialize"),
        Instruction::RotateAuthority => Ok("rotate"),
    }
}

#[cfg(test)]
mod tests {
    use super::{process_instruction, Instruction, ProgramError};

    #[test]
    fn unpacks_known_instructions() {
        assert_eq!(Instruction::unpack(&[0]), Ok(Instruction::{{instructionName}}));
        assert_eq!(Instruction::unpack(&[1]), Ok(Instruction::RotateAuthority));
    }

    #[test]
    fn rejects_unknown_instruction() {
        assert_eq!(Instruction::unpack(&[9]), Err(ProgramError::InvalidInstruction));
    }

    #[test]
    fn processes_initialize_path() {
        assert_eq!(process_instruction(&[0]), Ok("initialize"));
    }
}
