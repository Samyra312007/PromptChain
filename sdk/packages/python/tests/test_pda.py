from promptchain.pda import PDA
from solders.pubkey import Pubkey


def test_find_prompt_pda_deterministic():
    pda1, _ = PDA.find_prompt_pda("QmTest123")
    pda2, _ = PDA.find_prompt_pda("QmTest123")
    assert pda1 == pda2


def test_find_prompt_pda_differs():
    pda1, _ = PDA.find_prompt_pda("QmTest123")
    pda2, _ = PDA.find_prompt_pda("QmTest456")
    assert pda1 != pda2


def test_hash_cid_deterministic():
    a = PDA.hash_cid("QmTest123")
    b = PDA.hash_cid("QmTest123")
    assert a == b


def test_find_token_config_pda():
    pda, bump = PDA.find_token_config_pda()
    assert 0 <= bump <= 255
    assert str(pda)


def test_find_dao_config_pda():
    pda, bump = PDA.find_dao_config_pda()
    assert 0 <= bump <= 255
    assert str(pda)


def test_find_stake_position_pda():
    auth = Pubkey.new_unique()
    pda, bump = PDA.find_stake_position_pda(auth)
    assert 0 <= bump <= 255
    assert str(pda)


def test_find_proposal_pda():
    dao = Pubkey.new_unique()
    pda, bump = PDA.find_proposal_pda(dao, 1)
    assert 0 <= bump <= 255
    assert str(pda)


def test_all_program_ids():
    assert str(PDA.PROMPTCHAIN_PROGRAM_ID) == "D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F"
    assert str(PDA.CURATION_PROGRAM_ID) == "2eWqZR6HriWjKJs5MozSZKERxP98JM7FEwn8FA7Hh1cK"
    assert str(PDA.TOKEN_ECONOMICS_PROGRAM_ID) == "8mNqGqRJSkix3yCskAQBfTBhTyWMzYGMFmnfsEiyZnJU"
    assert str(PDA.GOVERNANCE_PROGRAM_ID) == "HvNzxKHRDNHMqeYRv5GPo2oV5fQABRPVLZMFMBE73tvu"
