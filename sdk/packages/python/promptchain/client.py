from typing import Optional

from anchorpy import Provider, Wallet
from solders.instruction import AccountMeta, Instruction
from solders.keypair import Keypair
from solders.message import Message
from solders.pubkey import Pubkey
from solders.system_program import ID as SYSTEM_PROGRAM_ID
from solders.transaction import Transaction
from solana.rpc.async_api import AsyncClient
from solana.rpc.commitment import Confirmed
from solana.rpc.types import TxOpts

from .pda import PDA
from .types import License, Prompt, PromptVersion


class PromptChainClient:
    def __init__(self, rpc_url: str, keypair: Optional[Keypair] = None):
        self.client = AsyncClient(rpc_url, commitment=Confirmed)
        self.promptchain_program = PDA.PROMPTCHAIN_PROGRAM_ID
        self.curation_program = PDA.CURATION_PROGRAM_ID
        self.token_economics_program = PDA.TOKEN_ECONOMICS_PROGRAM_ID
        self.governance_program = PDA.GOVERNANCE_PROGRAM_ID
        self.wallet = Wallet(keypair or Keypair())
        self.provider = Provider(self.client, self.wallet)

    async def publish(
        self,
        cid: str,
        metadata_uri: str,
        license: Optional[Pubkey] = None,
    ) -> str:
        prompt_pda, _ = PDA.find_prompt_pda(cid)
        ix = self._build_publish_ix(prompt_pda, cid, metadata_uri, license)
        return await self._send_tx([ix])

    async def create_version(
        self,
        prompt: Pubkey,
        cid: str,
        metadata_uri: str,
        changelog_uri: str,
    ) -> str:
        prompt_account = await self.fetch_prompt(prompt)
        version_pda, _ = PDA.find_version_pda(prompt, prompt_account.total_versions)
        ix = self._build_create_version_ix(
            prompt, version_pda, cid, metadata_uri, changelog_uri
        )
        return await self._send_tx([ix])

    async def set_license(
        self,
        name: str,
        commercial_allowed: bool,
        attribution_required: bool,
        royalty_basis_points: int,
    ) -> str:
        license_pda, _ = PDA.find_license_pda(self.wallet.public_key, name)
        ix = self._build_set_license_ix(
            license_pda, name, commercial_allowed, attribution_required, royalty_basis_points
        )
        return await self._send_tx([ix])

    async def transfer(self, prompt: Pubkey, new_authority: Pubkey) -> str:
        ix = self._build_transfer_ix(prompt, new_authority)
        return await self._send_tx([ix])

    async def fetch_prompt(self, address: Pubkey) -> Prompt:
        account_info = await self.client.get_account_info(address)
        data = account_info.value.data if account_info.value else b""
        return self._decode_prompt(data)

    async def fetch_license(self, address: Pubkey) -> License:
        account_info = await self.client.get_account_info(address)
        data = account_info.value.data if account_info.value else b""
        return self._decode_license(data)

    async def fetch_prompt_version(self, address: Pubkey) -> PromptVersion:
        account_info = await self.client.get_account_info(address)
        data = account_info.value.data if account_info.value else b""
        return self._decode_prompt_version(data)

    async def close(self) -> None:
        await self.client.close()

    def _build_publish_ix(
        self,
        prompt_pda: Pubkey,
        cid: str,
        metadata_uri: str,
        license: Optional[Pubkey] = None,
    ) -> Instruction:
        data = bytes([191, 77, 85, 178, 156, 5, 123, 246])
        cid_bytes = cid.encode()
        data += len(cid_bytes).to_bytes(4, "little") + cid_bytes
        uri_bytes = metadata_uri.encode()
        data += len(uri_bytes).to_bytes(4, "little") + uri_bytes
        data += b"\x01" + bytes(license) if license else b"\x00"
        accounts = [
            AccountMeta(prompt_pda, False, True),
            AccountMeta(self.wallet.public_key, True, True),
            AccountMeta(SYSTEM_PROGRAM_ID, False, False),
            AccountMeta(self.promptchain_program, False, False),
        ]
        return Instruction(self.promptchain_program, accounts, data)

    def _build_create_version_ix(
        self,
        prompt: Pubkey,
        version_pda: Pubkey,
        cid: str,
        metadata_uri: str,
        changelog_uri: str,
    ) -> Instruction:
        data = bytes([112, 201, 150, 145, 38, 101, 29, 69])
        for s in [cid, metadata_uri, changelog_uri]:
            b = s.encode()
            data += len(b).to_bytes(4, "little") + b
        accounts = [
            AccountMeta(prompt, False, False),
            AccountMeta(version_pda, False, True),
            AccountMeta(self.wallet.public_key, True, True),
            AccountMeta(SYSTEM_PROGRAM_ID, False, False),
        ]
        return Instruction(self.promptchain_program, accounts, data)

    def _build_set_license_ix(
        self,
        license_pda: Pubkey,
        name: str,
        commercial_allowed: bool,
        attribution_required: bool,
        royalty_basis_points: int,
    ) -> Instruction:
        data = bytes([102, 201, 74, 10, 209, 67, 114, 138])
        name_bytes = name.encode()
        data += len(name_bytes).to_bytes(4, "little") + name_bytes
        data += bytes([1 if commercial_allowed else 0])
        data += bytes([1 if attribution_required else 0])
        data += royalty_basis_points.to_bytes(2, "little")
        accounts = [
            AccountMeta(license_pda, False, True),
            AccountMeta(self.wallet.public_key, True, True),
            AccountMeta(SYSTEM_PROGRAM_ID, False, False),
        ]
        return Instruction(self.promptchain_program, accounts, data)

    def _build_transfer_ix(self, prompt: Pubkey, new_authority: Pubkey) -> Instruction:
        data = bytes([205, 170, 139, 114, 62, 15, 251, 183])
        data += bytes(new_authority)
        accounts = [
            AccountMeta(prompt, False, True),
            AccountMeta(self.wallet.public_key, True, False),
        ]
        return Instruction(self.promptchain_program, accounts, data)

    async def _send_tx(self, ixs: list[Instruction]) -> str:
        blockhash = (await self.client.get_latest_blockhash()).value.blockhash
        msg = Message.new_with_blockhash(ixs, self.wallet.public_key, blockhash)
        tx = Transaction.new_unsigned(msg)
        sig = await self.provider.send(tx, TxOpts(skip_confirmation=False))
        return str(sig)

    def _decode_prompt(self, data: bytes) -> Prompt:
        raw = data[8:]
        offset = 0
        authority = Pubkey.from_bytes(raw[offset : offset + 32])
        offset += 32
        original_authority = Pubkey.from_bytes(raw[offset : offset + 32])
        offset += 32
        cid_len = int.from_bytes(raw[offset : offset + 4], "little")
        offset += 4
        ipfs_cid = raw[offset : offset + cid_len].decode()
        offset += cid_len
        uri_len = int.from_bytes(raw[offset : offset + 4], "little")
        offset += 4
        metadata_uri = raw[offset : offset + uri_len].decode()
        offset += uri_len
        license_pk = Pubkey.from_bytes(raw[offset : offset + 32])
        offset += 32
        total_versions = int.from_bytes(raw[offset : offset + 4], "little")
        offset += 4
        total_uses = int.from_bytes(raw[offset : offset + 8], "little")
        return Prompt(
            authority=authority,
            original_authority=original_authority,
            ipfs_cid=ipfs_cid,
            metadata_uri=metadata_uri,
            license=license_pk,
            total_versions=total_versions,
            total_uses=total_uses,
        )

    def _decode_license(self, data: bytes) -> License:
        raw = data[8:]
        offset = 0
        authority = Pubkey.from_bytes(raw[offset : offset + 32])
        offset += 32
        name_len = int.from_bytes(raw[offset : offset + 4], "little")
        offset += 4
        name = raw[offset : offset + name_len].decode()
        offset += name_len
        commercial = bool(raw[offset])
        offset += 1
        attribution = bool(raw[offset])
        offset += 1
        royalty = int.from_bytes(raw[offset : offset + 2], "little")
        return License(
            authority=authority,
            name=name,
            commercial_allowed=commercial,
            attribution_required=attribution,
            royalty_basis_points=royalty,
        )

    def _decode_prompt_version(self, data: bytes) -> PromptVersion:
        raw = data[8:]
        offset = 0
        parent = Pubkey.from_bytes(raw[offset : offset + 32])
        offset += 32
        version_number = int.from_bytes(raw[offset : offset + 4], "little")
        offset += 4
        author = Pubkey.from_bytes(raw[offset : offset + 32])
        offset += 32
        cid_len = int.from_bytes(raw[offset : offset + 4], "little")
        offset += 4
        ipfs_cid = raw[offset : offset + cid_len].decode()
        offset += cid_len
        uri_len = int.from_bytes(raw[offset : offset + 4], "little")
        offset += 4
        metadata_uri = raw[offset : offset + uri_len].decode()
        offset += uri_len
        changelog_len = int.from_bytes(raw[offset : offset + 4], "little")
        offset += 4
        changelog_uri = raw[offset : offset + changelog_len].decode()
        return PromptVersion(
            parent=parent,
            version_number=version_number,
            author=author,
            ipfs_cid=ipfs_cid,
            metadata_uri=metadata_uri,
            changelog_uri=changelog_uri,
        )
