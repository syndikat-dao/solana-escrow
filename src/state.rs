use solana_program::{
    program_error::ProgramError,
    program_pack::{IsInitialized, Pack, Sealed},
    pubkey::Pubkey,
};
use arrayref::{array_mut_ref, array_ref, array_refs, mut_array_refs};

/// SwapPair represents the state of a swap pair on-chain.
pub struct SwapPair {
    pub is_initialized: bool,
    pub creator_pubkey: Pubkey,
    pub token_a_mint: Pubkey,
    pub token_b_mint: Pubkey,
    pub token_a_account: Pubkey,
    pub amount_a: u64,
    pub price_b: u64,
    pub is_active: bool,
}

impl Sealed for SwapPair {}

impl IsInitialized for SwapPair {
    fn is_initialized(&self) -> bool {
        self.is_initialized
    }
}

impl Pack for SwapPair {
    const LEN: usize = 1    // is_initialized: 1 byte
        + 32               // creator_pubkey: 32 bytes
        + 32               // token_a_mint: 32 bytes
        + 32               // token_b_mint: 32 bytes
        + 32               // token_a_account: 32 bytes
        + 8                // amount_a: 8 bytes
        + 8                // price_b: 8 bytes
        + 1;               // is_active: 1 byte

    /// Packs a `SwapPair` into a mutable slice.
    fn pack_into_slice(&self, dst: &mut [u8]) {
        let dst = array_mut_ref![dst, 0, SwapPair::LEN];
        let (
            is_initialized_dst,
            creator_pubkey_dst,
            token_a_mint_dst,
            token_b_mint_dst,
            token_a_account_dst,
            amount_a_dst,
            price_b_dst,
            is_active_dst,
        ) = mut_array_refs![dst, 1, 32, 32, 32, 32, 8, 8, 1];

        is_initialized_dst[0] = self.is_initialized as u8;
        creator_pubkey_dst.copy_from_slice(self.creator_pubkey.as_ref());
        token_a_mint_dst.copy_from_slice(self.token_a_mint.as_ref());
        token_b_mint_dst.copy_from_slice(self.token_b_mint.as_ref());
        token_a_account_dst.copy_from_slice(self.token_a_account.as_ref());
        *amount_a_dst = self.amount_a.to_le_bytes();
        *price_b_dst = self.price_b.to_le_bytes();
        is_active_dst[0] = self.is_active as u8;
    }

    /// Unpacks a `SwapPair` from a slice.
    fn unpack_from_slice(src: &[u8]) -> Result<Self, ProgramError> {
        let src = array_ref![src, 0, SwapPair::LEN];
        let (
            is_initialized,
            creator_pubkey,
            token_a_mint,
            token_b_mint,
            token_a_account,
            amount_a,
            price_b,
            is_active,
        ) = array_refs![src, 1, 32, 32, 32, 32, 8, 8, 1];

        Ok(SwapPair {
            is_initialized: is_initialized[0] != 0,
            creator_pubkey: Pubkey::new_from_array(*creator_pubkey),
            token_a_mint: Pubkey::new_from_array(*token_a_mint),
            token_b_mint: Pubkey::new_from_array(*token_b_mint),
            token_a_account: Pubkey::new_from_array(*token_a_account),
            amount_a: u64::from_le_bytes(*amount_a),
            price_b: u64::from_le_bytes(*price_b),
            is_active: is_active[0] != 0,
        })
    }
}
