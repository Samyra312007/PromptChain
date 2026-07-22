import hashlib
from solders.pubkey import Pubkey


class PDA:
    PROMPTCHAIN_PROGRAM_ID = Pubkey.from_string("D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F")
    CURATION_PROGRAM_ID = Pubkey.from_string("2eWqZR6HriWjKJs5MozSZKERxP98JM7FEwn8FA7Hh1cK")
    TOKEN_ECONOMICS_PROGRAM_ID = Pubkey.from_string("8mNqGqRJSkix3yCskAQBfTBhTyWMzYGMFmnfsEiyZnJU")
    GOVERNANCE_PROGRAM_ID = Pubkey.from_string("HvNzxKHRDNHMqeYRv5GPo2oV5fQABRPVLZMFMBE73tvu")

    @staticmethod
    def hash_cid(cid: str) -> bytes:
        return hashlib.sha256(cid.encode()).digest()

    @staticmethod
    def find_prompt_pda(cid: str) -> tuple[Pubkey, int]:
        cid_hash = PDA.hash_cid(cid)
        return Pubkey.find_program_address(
            [b"prompt", bytes(cid_hash)],
            PDA.PROMPTCHAIN_PROGRAM_ID,
        )

    @staticmethod
    def find_version_pda(prompt: Pubkey, version_number: int) -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"version", bytes(prompt), version_number.to_bytes(4, "little")],
            PDA.PROMPTCHAIN_PROGRAM_ID,
        )

    @staticmethod
    def find_license_pda(authority: Pubkey, name: str) -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"license", bytes(authority), name.encode()],
            PDA.PROMPTCHAIN_PROGRAM_ID,
        )

    @staticmethod
    def find_curator_pda(authority: Pubkey) -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"curator", bytes(authority)],
            PDA.CURATION_PROGRAM_ID,
        )

    @staticmethod
    def find_rating_pda(curator: Pubkey, prompt: Pubkey) -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"rating", bytes(curator), bytes(prompt)],
            PDA.CURATION_PROGRAM_ID,
        )

    @staticmethod
    def find_reputation_pda(authority: Pubkey) -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"reputation", bytes(authority)],
            PDA.CURATION_PROGRAM_ID,
        )

    @staticmethod
    def find_token_config_pda() -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"token_config"],
            PDA.TOKEN_ECONOMICS_PROGRAM_ID,
        )

    @staticmethod
    def find_token_mint_pda() -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"token_mint"],
            PDA.TOKEN_ECONOMICS_PROGRAM_ID,
        )

    @staticmethod
    def find_stake_position_pda(authority: Pubkey) -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"stake_position", bytes(authority)],
            PDA.TOKEN_ECONOMICS_PROGRAM_ID,
        )

    @staticmethod
    def find_vesting_pda(beneficiary: Pubkey) -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"vesting", bytes(beneficiary)],
            PDA.TOKEN_ECONOMICS_PROGRAM_ID,
        )

    @staticmethod
    def find_dao_config_pda() -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"dao_config"],
            PDA.GOVERNANCE_PROGRAM_ID,
        )

    @staticmethod
    def find_member_pda(authority: Pubkey) -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"member", bytes(authority)],
            PDA.GOVERNANCE_PROGRAM_ID,
        )

    @staticmethod
    def find_proposal_pda(dao_config: Pubkey, proposal_id: int) -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"proposal", bytes(dao_config), proposal_id.to_bytes(8, "little")],
            PDA.GOVERNANCE_PROGRAM_ID,
        )

    @staticmethod
    def find_vote_pda(voter: Pubkey, proposal: Pubkey) -> tuple[Pubkey, int]:
        return Pubkey.find_program_address(
            [b"vote", bytes(voter), bytes(proposal)],
            PDA.GOVERNANCE_PROGRAM_ID,
        )
