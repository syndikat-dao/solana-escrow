use solana_program::pubkey::Pubkey;
use solana_program::program_error::ProgramError;
use std::convert::TryInto;

use crate::error::EscrowError::InvalidInstruction;

pub enum EscrowInstruction {
    InitEscrow {
        amount: u64,
    },
    CreateSwapPair {
        token_a_mint: Pubkey,
        token_b_mint: Pubkey,
        amount_a: u64,
        price_b: u64,
    },
    ExecuteSwap {
        swap_pair_id: Pubkey,
    },
}

impl EscrowInstruction {
    pub fn unpack(input: &[u8]) -> Result<Self, ProgramError> {
        let (tag, rest) = input.split_first().ok_or(InvalidInstruction)?;

        Ok(match tag {
            0 => Self::InitEscrow {
                amount: Self::unpack_amount(rest)?,
            },
            1 => {
                let (token_a_mint, rest) = Self::unpack_pubkey(rest)?;
                let (token_b_mint, rest) = Self::unpack_pubkey(rest)?;
                let (amount_a, rest) = Self::unpack_u64(rest)?;
                let (price_b, _) = Self::unpack_u64(rest)?;
                
                Self::CreateSwapPair {
                    token_a_mint,
                    token_b_mint,
                    amount_a,
                    price_b,
                }
            },
            2 => {
                let (swap_pair_id, _) = Self::unpack_pubkey(rest)?;
                Self::ExecuteSwap { swap_pair_id }
            },
            _ => return Err(InvalidInstruction.into()),
        })
    }

    fn unpack_amount(input: &[u8]) -> Result<u64, ProgramError> {
        let amount = input
            .get(..8)
            .and_then(|slice| slice.try_into().ok())
            .map(u64::from_le_bytes)
            .ok_or(InvalidInstruction)?;
        Ok(amount)
    }

    fn unpack_pubkey(input: &[u8]) -> Result<(Pubkey, &[u8]), ProgramError> {
        if input.len() < 32 {
            return Err(InvalidInstruction.into());
        }
        let (key, rest) = input.split_at(32);
        let pk = Pubkey::from(key);
        Ok((pk, rest))
    }

    fn unpack_u64(input: &[u8]) -> Result<(u64, &[u8]), ProgramError> {
        if input.len() < 8 {
            return Err(InvalidInstruction.into());
        }
        let (amount, rest) = input.split_at(8);
        let amount = amount.try_into()
            .map(u64::from_le_bytes)
            .map_err(|_| InvalidInstruction)?;
        Ok((amount, rest))
    }
}
