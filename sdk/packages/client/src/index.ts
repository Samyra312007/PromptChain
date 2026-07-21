import {
  PublicKey,
  SystemProgram,
  TransactionSignature,
} from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { PROMPTCHAIN_PROGRAM_ID, PDA_SEEDS } from "@promptchain/schema";

import idl from "./idl/promptchain.json";

export interface PromptAccount {
  authority: PublicKey;
  ipfsCid: string;
  metadataUri: string;
  license: PublicKey;
  totalVersions: number;
  totalUses: BN;
  bump: number;
}

export interface PromptVersionAccount {
  parent: PublicKey;
  versionNumber: number;
  author: PublicKey;
  ipfsCid: string;
  metadataUri: string;
  changelogUri: string;
  bump: number;
}

export interface LicenseAccount {
  authority: PublicKey;
  name: string;
  commercialAllowed: boolean;
  attributionRequired: boolean;
  royaltyBasisPoints: number;
  bump: number;
}

export type PublishParams = {
  authority: PublicKey;
  cid: string;
  metadataUri: string;
  license?: PublicKey;
};

export type CreateVersionParams = {
  prompt: PublicKey;
  authority: PublicKey;
  cid: string;
  metadataUri: string;
  changelogUri: string;
};

export type SetLicenseParams = {
  authority: PublicKey;
  name: string;
  commercialAllowed: boolean;
  attributionRequired: boolean;
  royaltyBasisPoints: number;
};

export type TransferParams = {
  prompt: PublicKey;
  currentAuthority: PublicKey;
  newAuthority: PublicKey;
};

export type UsePromptParams = {
  prompt: PublicKey;
  license: PublicKey;
  licenseAuthority: PublicKey;
  payer: PublicKey;
  maxRoyaltyPayment: BN;
};

export function findPromptPda(authority: PublicKey, cid: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.PROMPT, authority.toBuffer(), Buffer.from(cid)],
    new PublicKey(PROMPTCHAIN_PROGRAM_ID),
  );
}

export function findVersionPda(prompt: PublicKey, versionNumber: number): [PublicKey, number] {
  const buf = Buffer.alloc(4);
  buf.writeUInt32LE(versionNumber);
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.VERSION, prompt.toBuffer(), buf],
    new PublicKey(PROMPTCHAIN_PROGRAM_ID),
  );
}

export function findLicensePda(authority: PublicKey, name: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [PDA_SEEDS.LICENSE, authority.toBuffer(), Buffer.from(name)],
    new PublicKey(PROMPTCHAIN_PROGRAM_ID),
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProgram = any;

export class PromptChainClient {
  private program: AnyProgram;

  constructor(provider: AnchorProvider) {
    this.program = new Program(idl, provider);
  }

  get programId(): PublicKey {
    return this.program.programId;
  }

  async publish(params: PublishParams): Promise<TransactionSignature> {
    const [promptPda] = findPromptPda(params.authority, params.cid);
    return this.program.methods
      .publish(params.cid, params.metadataUri, params.license ?? null)
      .accounts({
        prompt: promptPda,
        authority: params.authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async createVersion(params: CreateVersionParams): Promise<TransactionSignature> {
    const promptAccount: PromptAccount = await this.fetchPrompt(params.prompt);
    const versionNumber = promptAccount.totalVersions;
    const [versionPda] = findVersionPda(params.prompt, versionNumber);
    return this.program.methods
      .createVersion(params.cid, params.metadataUri, params.changelogUri)
      .accounts({
        prompt: params.prompt,
        version: versionPda,
        authority: params.authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async setLicense(params: SetLicenseParams): Promise<TransactionSignature> {
    const [licensePda] = findLicensePda(params.authority, params.name);
    return this.program.methods
      .setLicense(
        params.name,
        params.commercialAllowed,
        params.attributionRequired,
        params.royaltyBasisPoints,
      )
      .accounts({
        license: licensePda,
        authority: params.authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async transfer(params: TransferParams): Promise<TransactionSignature> {
    return this.program.methods
      .transfer(params.newAuthority)
      .accounts({
        prompt: params.prompt,
        currentAuthority: params.currentAuthority,
      })
      .rpc();
  }

  async usePrompt(params: UsePromptParams): Promise<TransactionSignature> {
    return this.program.methods
      .usePrompt(params.maxRoyaltyPayment)
      .accounts({
        prompt: params.prompt,
        license: params.license,
        payer: params.payer,
        licenseAuthority: params.licenseAuthority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async fetchPrompt(address: PublicKey): Promise<PromptAccount> {
    return this.program.account.prompt.fetch(address);
  }

  async fetchVersion(address: PublicKey): Promise<PromptVersionAccount> {
    return this.program.account.promptVersion.fetch(address);
  }

  async fetchLicense(address: PublicKey): Promise<LicenseAccount> {
    return this.program.account.license.fetch(address);
  }

  async fetchPromptsByAuthority(authority: PublicKey): Promise<Array<{ publicKey: PublicKey; account: PromptAccount }>> {
    const prompts = await this.program.account.prompt.all([
      { memcmp: { offset: 0, bytes: authority.toBase58() } },
    ]);
    return prompts.map((p: { publicKey: PublicKey; account: PromptAccount }) => ({
      publicKey: p.publicKey,
      account: p.account,
    }));
  }
}
