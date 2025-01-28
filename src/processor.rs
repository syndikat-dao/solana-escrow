use solana_program::{
    account_info::{next_account_info, AccountInfo},
    entrypoint::ProgramResult,
    msg,
    program::invoke,
    program_error::ProgramError,
    program_pack::Pack,
    pubkey::Pubkey,
    sysvar::{rent::Rent, Sysvar},
};

use crate::{
    error::EscrowError,
    instruction::EscrowInstruction,
    state::SwapPair,
};

pub struct Processor;

impl Processor {
    pub fn process(
        program_id: &Pubkey,
        accounts: &[AccountInfo],
        instruction_data: &[u8],
    ) -> ProgramResult {
        let instruction = EscrowInstruction::unpack(instruction_data)?;

        match instruction {
            EscrowInstruction::CreateSwapPair { token_a_mint, token_b_mint, amount_a, price_b } => {
                Self::process_create_swap_pair(
                    accounts,
                    token_a_mint,
                    token_b_mint,
                    amount_a,
                    price_b,
                    program_id,
                )
            }
            EscrowInstruction::ExecuteSwap { swap_pair_id } => {
                Self::process_execute_swap(accounts, swap_pair_id, program_id)
            }
            EscrowInstruction::InitEscrow { .. } => {
                msg!("InitEscrow instruction is not implemented.");
                Err(ProgramError::InvalidInstructionData)
            }
        }
    }

    fn process_create_swap_pair(
        accounts: &[AccountInfo],
        token_a_mint: Pubkey,
        token_b_mint: Pubkey,
        amount_a: u64,
        price_b: u64,
        program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let creator = next_account_info(account_info_iter)?;

        // Check if the creator is a signer
        if !creator.is_signer {
            return Err(ProgramError::MissingRequiredSignature);
        }

        let swap_pair_account = next_account_info(account_info_iter)?;
        let rent = Rent::from_account_info(next_account_info(account_info_iter)?)?;

        // Check rent exemption
        if !rent.is_exempt(swap_pair_account.lamports(), SwapPair::LEN) {
            return Err(EscrowError::NotRentExempt.into());
        }

        // Verify program ownership
        if swap_pair_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }

        let swap_pair_state = SwapPair {
            is_initialized: true,
            is_active: true,
            creator_pubkey: *creator.key,
            token_a_mint,
            token_b_mint,
            token_a_account: *swap_pair_account.key,
            amount_a,
            price_b,
        };

        SwapPair::pack(swap_pair_state, &mut swap_pair_account.try_borrow_mut_data()?)?;
        msg!("Created new swap pair successfully!");
        Ok(())
    }

    fn process_execute_swap(
        accounts: &[AccountInfo],
        swap_pair_id: Pubkey,
        program_id: &Pubkey,
    ) -> ProgramResult {
        let account_info_iter = &mut accounts.iter();
        let taker = next_account_info(account_info_iter)?;
        let swap_pair_account = next_account_info(account_info_iter)?;

        // Verify the swap pair account matches the provided ID
        if *swap_pair_account.key != swap_pair_id {
            return Err(EscrowError::InvalidSwapPair.into());
        }

        // Verify program ownership
        if swap_pair_account.owner != program_id {
            return Err(ProgramError::IncorrectProgramId);
        }

        let taker_token_b_account = next_account_info(account_info_iter)?;
        let creator_token_b_account = next_account_info(account_info_iter)?;
        let token_program = next_account_info(account_info_iter)?;

        let mut swap_pair_data = SwapPair::unpack(&swap_pair_account.try_borrow_data()?)?;
        if !swap_pair_data.is_initialized || !swap_pair_data.is_active {
            return Err(ProgramError::InvalidAccountData);
        }

        // Check if the taker is the same as the creator
        if swap_pair_data.creator_pubkey == *taker.key {
            return Err(ProgramError::InvalidAccountData);
        }

        // Perform token transfer for the swap
        let transfer_b_ix = spl_token::instruction::transfer(
            token_program.key,
            taker_token_b_account.key,
            creator_token_b_account.key,
            taker.key,
            &[&taker.key],
            swap_pair_data.price_b,
        )?;

        invoke(
            &transfer_b_ix,
            &[
                taker_token_b_account.clone(),
                creator_token_b_account.clone(),
                taker.clone(),
                token_program.clone(),
            ],
        )?;

        msg!("Executed swap successfully!");

        // Mark the swap as inactive
        swap_pair_data.is_active = false;
        SwapPair::pack(swap_pair_data, &mut swap_pair_account.try_borrow_mut_data()?)?;

        Ok(())
    }
}
