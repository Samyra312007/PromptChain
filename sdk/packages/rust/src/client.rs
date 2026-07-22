use std::str::FromStr;

use anyhow::Result;
use solana_client::nonblocking::rpc_client::RpcClient;
use solana_sdk::{
    instruction::{AccountMeta, Instruction},
    pubkey::Pubkey,
    signature::{Keypair, Signer},
    transaction::Transaction,
};

use crate::pda::*;
use crate::types::*;

pub struct PromptChainClient {
    pub rpc_client: RpcClient,
    pub promptchain_program: Pubkey,
    pub curation_program: Pubkey,
    pub token_economics_program: Pubkey,
    pub governance_program: Pubkey,
}

impl PromptChainClient {
    pub fn new(rpc_url: &str) -> Self {
        Self {
            rpc_client: RpcClient::new(rpc_url.to_string()),
            promptchain_program: Pubkey::from_str(PROMPTCHAIN_PROGRAM_ID).unwrap(),
            curation_program: Pubkey::from_str(CURATION_PROGRAM_ID).unwrap(),
            token_economics_program: Pubkey::from_str(TOKEN_ECONOMICS_PROGRAM_ID).unwrap(),
            governance_program: Pubkey::from_str(GOVERNANCE_PROGRAM_ID).unwrap(),
        }
    }

    pub async fn publish(
        &self,
        authority: &Keypair,
        cid: String,
        metadata_uri: String,
        license: Option<Pubkey>,
    ) -> Result<String> {
        let (prompt_pda, _) = find_prompt_pda(&cid);
        let data = self.encode_publish_instruction(&cid, &metadata_uri, &license);
        let accounts = vec![
            AccountMeta::new(prompt_pda, false),
            AccountMeta::new(authority.pubkey(), true),
            AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
        ];
        let ix = Instruction {
            program_id: self.promptchain_program,
            accounts,
            data,
        };
        self.send_and_confirm(authority, &[ix]).await
    }

    pub async fn create_version(
        &self,
        authority: &Keypair,
        prompt: Pubkey,
        cid: String,
        metadata_uri: String,
        changelog_uri: String,
    ) -> Result<String> {
        let prompt_account = self.fetch_prompt(&prompt).await?;
        let (version_pda, _) = find_version_pda(&prompt, prompt_account.total_versions);
        let data = self.encode_create_version_instruction(&cid, &metadata_uri, &changelog_uri);
        let accounts = vec![
            AccountMeta::new(prompt, false),
            AccountMeta::new(version_pda, false),
            AccountMeta::new(authority.pubkey(), true),
            AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
        ];
        let ix = Instruction {
            program_id: self.promptchain_program,
            accounts,
            data,
        };
        self.send_and_confirm(authority, &[ix]).await
    }

    pub async fn set_license(
        &self,
        authority: &Keypair,
        name: String,
        commercial_allowed: bool,
        attribution_required: bool,
        royalty_basis_points: u16,
    ) -> Result<String> {
        let (license_pda, _) = find_license_pda(&authority.pubkey(), &name);
        let data = self.encode_set_license_instruction(
            &name,
            commercial_allowed,
            attribution_required,
            royalty_basis_points,
        );
        let accounts = vec![
            AccountMeta::new(license_pda, false),
            AccountMeta::new(authority.pubkey(), true),
            AccountMeta::new_readonly(solana_sdk::system_program::id(), false),
        ];
        let ix = Instruction {
            program_id: self.promptchain_program,
            accounts,
            data,
        };
        self.send_and_confirm(authority, &[ix]).await
    }

    pub async fn transfer(
        &self,
        current_authority: &Keypair,
        prompt: Pubkey,
        new_authority: Pubkey,
    ) -> Result<String> {
        let data = self.encode_transfer_instruction(&new_authority);
        let accounts = vec![
            AccountMeta::new(prompt, false),
            AccountMeta::new(current_authority.pubkey(), true),
        ];
        let ix = Instruction {
            program_id: self.promptchain_program,
            accounts,
            data,
        };
        self.send_and_confirm(current_authority, &[ix]).await
    }

    pub async fn fetch_prompt(&self, address: &Pubkey) -> Result<Prompt> {
        let account = self.rpc_client.get_account(address).await?;
        let data = account.data;
        let discriminator = &data[..8];
        let expected: [u8; 8] = [162, 142, 134, 3, 160, 50, 191, 163];
        if discriminator != expected {
            anyhow::bail!("Account is not a Prompt account");
        }
        let prompt: Prompt = borsh::from_slice(&data[8..])?;
        Ok(prompt)
    }

    pub async fn fetch_license(&self, address: &Pubkey) -> Result<License> {
        let account = self.rpc_client.get_account(address).await?;
        let data = &account.data[8..];
        let license: License = borsh::from_slice(data)?;
        Ok(license)
    }

    pub async fn fetch_prompt_version(&self, address: &Pubkey) -> Result<PromptVersion> {
        let account = self.rpc_client.get_account(address).await?;
        let data = &account.data[8..];
        let version: PromptVersion = borsh::from_slice(data)?;
        Ok(version)
    }

    async fn send_and_confirm(&self, signer: &Keypair, ixs: &[Instruction]) -> Result<String> {
        let recent_blockhash = self.rpc_client.get_latest_blockhash().await?;
        let tx = Transaction::new_signed_with_payer(
            ixs,
            Some(&signer.pubkey()),
            &[signer],
            recent_blockhash,
        );
        let sig = self.rpc_client.send_and_confirm_transaction(&tx).await?;
        Ok(sig.to_string())
    }

    fn encode_publish_instruction(
        &self,
        cid: &str,
        metadata_uri: &str,
        license: &Option<Pubkey>,
    ) -> Vec<u8> {
        let mut data = vec![];
        data.extend_from_slice(&[191, 77, 85, 178, 156, 5, 123, 246]);
        let cid_bytes = cid.as_bytes();
        data.extend_from_slice(&(cid_bytes.len() as u32).to_le_bytes());
        data.extend_from_slice(cid_bytes);
        let uri_bytes = metadata_uri.as_bytes();
        data.extend_from_slice(&(uri_bytes.len() as u32).to_le_bytes());
        data.extend_from_slice(uri_bytes);
        match license {
            Some(pk) => {
                data.push(1);
                data.extend_from_slice(&pk.to_bytes());
            }
            None => {
                data.push(0);
            }
        }
        data
    }

    fn encode_create_version_instruction(
        &self,
        _cid: &str,
        _metadata_uri: &str,
        _changelog_uri: &str,
    ) -> Vec<u8> {
        vec![]
    }

    fn encode_set_license_instruction(
        &self,
        _name: &str,
        _commercial: bool,
        _attribution: bool,
        _royalty: u16,
    ) -> Vec<u8> {
        vec![]
    }

    fn encode_transfer_instruction(&self, _new_authority: &Pubkey) -> Vec<u8> {
        vec![]
    }
}
