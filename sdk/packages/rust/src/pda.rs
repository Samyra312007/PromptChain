use sha2::{Digest, Sha256};
use solana_sdk::pubkey::Pubkey;

pub const PROMPTCHAIN_PROGRAM_ID: &str = "D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F";
pub const CURATION_PROGRAM_ID: &str = "2eWqZR6HriWjKJs5MozSZKERxP98JM7FEwn8FA7Hh1cK";
pub const TOKEN_ECONOMICS_PROGRAM_ID: &str = "8mNqGqRJSkix3yCskAQBfTBhTyWMzYGMFmnfsEiyZnJU";
pub const GOVERNANCE_PROGRAM_ID: &str = "HvNzxKHRDNHMqeYRv5GPo2oV5fQABRPVLZMFMBE73tvu";

fn program_id(id: &str) -> Pubkey {
    id.parse().expect("Invalid program ID")
}

pub fn hash_cid(cid: &str) -> [u8; 32] {
    let mut hasher = Sha256::new();
    hasher.update(cid.as_bytes());
    let result = hasher.finalize();
    let mut hash = [0u8; 32];
    hash.copy_from_slice(&result);
    hash
}

pub fn find_prompt_pda(cid: &str) -> (Pubkey, u8) {
    let cid_hash = hash_cid(cid);
    Pubkey::find_program_address(
        &[b"prompt", &cid_hash],
        &program_id(PROMPTCHAIN_PROGRAM_ID),
    )
}

pub fn find_version_pda(prompt: &Pubkey, version_number: u32) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"version", &prompt.to_bytes(), &version_number.to_le_bytes()],
        &program_id(PROMPTCHAIN_PROGRAM_ID),
    )
}

pub fn find_license_pda(authority: &Pubkey, name: &str) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"license", &authority.to_bytes(), name.as_bytes()],
        &program_id(PROMPTCHAIN_PROGRAM_ID),
    )
}

pub fn find_curator_pda(authority: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"curator", &authority.to_bytes()],
        &program_id(CURATION_PROGRAM_ID),
    )
}

pub fn find_rating_pda(curator: &Pubkey, prompt: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"rating", &curator.to_bytes(), &prompt.to_bytes()],
        &program_id(CURATION_PROGRAM_ID),
    )
}

pub fn find_prompt_curation_pda(prompt: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"prompt_curation", &prompt.to_bytes()],
        &program_id(CURATION_PROGRAM_ID),
    )
}

pub fn find_reputation_pda(authority: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"reputation", &authority.to_bytes()],
        &program_id(CURATION_PROGRAM_ID),
    )
}

pub fn find_token_config_pda() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"token_config"], &program_id(TOKEN_ECONOMICS_PROGRAM_ID))
}

pub fn find_token_mint_pda() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"token_mint"], &program_id(TOKEN_ECONOMICS_PROGRAM_ID))
}

pub fn find_stake_position_pda(authority: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"stake_position", &authority.to_bytes()],
        &program_id(TOKEN_ECONOMICS_PROGRAM_ID),
    )
}

pub fn find_vesting_pda(beneficiary: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"vesting", &beneficiary.to_bytes()],
        &program_id(TOKEN_ECONOMICS_PROGRAM_ID),
    )
}

pub fn find_dao_config_pda() -> (Pubkey, u8) {
    Pubkey::find_program_address(&[b"dao_config"], &program_id(GOVERNANCE_PROGRAM_ID))
}

pub fn find_member_pda(authority: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"member", &authority.to_bytes()],
        &program_id(GOVERNANCE_PROGRAM_ID),
    )
}

pub fn find_proposal_pda(dao_config: &Pubkey, proposal_id: u64) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"proposal", &dao_config.to_bytes(), &proposal_id.to_le_bytes()],
        &program_id(GOVERNANCE_PROGRAM_ID),
    )
}

pub fn find_vote_pda(voter: &Pubkey, proposal: &Pubkey) -> (Pubkey, u8) {
    Pubkey::find_program_address(
        &[b"vote", &voter.to_bytes(), &proposal.to_bytes()],
        &program_id(GOVERNANCE_PROGRAM_ID),
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_hash_cid_deterministic() {
        let a = hash_cid("QmTest123");
        let b = hash_cid("QmTest123");
        assert_eq!(a, b);
    }

    #[test]
    fn test_hash_cid_differs() {
        let a = hash_cid("QmTest123");
        let b = hash_cid("QmTest456");
        assert_ne!(a, b);
    }

    #[test]
    fn test_find_prompt_pda_deterministic() {
        let (pda1, _) = find_prompt_pda("QmTest123");
        let (pda2, _) = find_prompt_pda("QmTest123");
        assert_eq!(pda1, pda2);
    }

    #[test]
    fn test_find_prompt_pda_differs() {
        let (pda1, _) = find_prompt_pda("QmTest123");
        let (pda2, _) = find_prompt_pda("QmTest456");
        assert_ne!(pda1, pda2);
    }

    #[test]
    fn test_find_license_pda_deterministic() {
        let auth = Pubkey::new_unique();
        let (pda1, _) = find_license_pda(&auth, "MIT");
        let (pda2, _) = find_license_pda(&auth, "MIT");
        assert_eq!(pda1, pda2);
    }

    #[test]
    fn test_find_token_config_pda_deterministic() {
        let (pda1, _) = find_token_config_pda();
        let (pda2, _) = find_token_config_pda();
        assert_eq!(pda1, pda2);
    }

    #[test]
    fn test_find_dao_config_pda_deterministic() {
        let (pda1, _) = find_dao_config_pda();
        let (pda2, _) = find_dao_config_pda();
        assert_eq!(pda1, pda2);
    }

    #[test]
    fn test_find_member_pda_deterministic() {
        let auth = Pubkey::new_unique();
        let (pda1, _) = find_member_pda(&auth);
        let (pda2, _) = find_member_pda(&auth);
        assert_eq!(pda1, pda2);
    }
}
