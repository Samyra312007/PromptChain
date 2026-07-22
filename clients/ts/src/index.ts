import {
  PublicKey,
  Connection,
  SystemProgram,
  TransactionSignature,
  Keypair,
} from "@solana/web3.js";
import { Program, AnchorProvider, Wallet, BN } from "@coral-xyz/anchor";
import { createHash } from "crypto";
import { PROMPTCHAIN_PROGRAM_ID, PDA_SEEDS, type PromptMetadata } from "@promptchain/schema";
import { PromptFs, readPromptFile, computeCid, scanDirectoryTree } from "@promptchain/storage";

import idl from "./idl/promptchain.json";

// Re-export types


export interface PublishLocalParams {
  filePath: string;
  license?: PublicKey;
}

export interface PublishTextParams {
  name: string;
  promptText: string;
  metadata: PromptMetadata;
  license?: PublicKey;
}

export interface CreateVersionLocalParams {
  promptAddress: PublicKey;
  filePath: string;
  changelogUri: string;
}

export interface SyncDirectoryParams {
  directory: string;
  onProgress?: (current: number, total: number) => void;
}

export interface SyncResult {
  published: number;
  skipped: number;
  errors: Array<{ file: string; error: string }>;
}

export class FullClient {
  private program: any;
  private provider: AnchorProvider;
  private _fs: PromptFs | null = null;

  constructor(provider: AnchorProvider) {
    this.provider = provider;
    this.program = new Program(idl as any, provider);
  }

  get programId(): PublicKey {
    return this.program.programId;
  }

  get fs(): PromptFs | null {
    return this._fs;
  }

  // --- PDA helpers ---

  findPromptPda(cid: string): [PublicKey, number] {
    const cidHash = createHash("sha256").update(cid, "utf8").digest();
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.PROMPT, cidHash],
      new PublicKey(PROMPTCHAIN_PROGRAM_ID),
    );
  }

  findVersionPda(prompt: PublicKey, versionNumber: number): [PublicKey, number] {
    const buf = Buffer.alloc(4);
    buf.writeUInt32LE(versionNumber);
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.VERSION, prompt.toBuffer(), buf],
      new PublicKey(PROMPTCHAIN_PROGRAM_ID),
    );
  }

  findLicensePda(name: string): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [PDA_SEEDS.LICENSE, this.provider.wallet.publicKey.toBuffer(), Buffer.from(name)],
      new PublicKey(PROMPTCHAIN_PROGRAM_ID),
    );
  }

  // --- On-chain operations ---

  async publish(params: PublishLocalParams | PublishTextParams): Promise<{
    signature: TransactionSignature;
    promptAddress: PublicKey;
    cid: string;
  }> {
    let cid: string;
    let metadataUri: string;
    let license: PublicKey | undefined;
    const authority = this.provider.wallet.publicKey;

    if ("filePath" in params) {
      const pf = await readPromptFile(params.filePath);
      cid = pf.cid;
      metadataUri = `file://${params.filePath}`;
      license = params.license;
    } else {
      cid = computeCid(params.promptText);
      metadataUri = `prompt://${params.name}`;
      license = params.license;
    }

    const [promptPda] = this.findPromptPda(cid);

    const signature = await this.program.methods
      .publish(cid, metadataUri, license ?? null)
      .accounts({
        prompt: promptPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    return { signature, promptAddress: promptPda, cid };
  }

  async createVersion(params: CreateVersionLocalParams): Promise<TransactionSignature> {
    const pf = await readPromptFile(params.filePath);
    const cid = pf.cid;
    const metadataUri = `file://${params.filePath}`;
    const authority = this.provider.wallet.publicKey;

    const promptAccount: any = await this.program.account.prompt.fetch(
      params.promptAddress,
    );
    const versionNumber = promptAccount.totalVersions;
    const [versionPda] = this.findVersionPda(params.promptAddress, versionNumber);

    return this.program.methods
      .createVersion(cid, metadataUri, params.changelogUri)
      .accounts({
        prompt: params.promptAddress,
        version: versionPda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async setLicense(
    name: string,
    commercialAllowed: boolean,
    attributionRequired: boolean,
    royaltyBasisPoints: number,
  ): Promise<TransactionSignature> {
    const authority = this.provider.wallet.publicKey;
    const [licensePda] = this.findLicensePda(name);

    return this.program.methods
      .setLicense(name, commercialAllowed, attributionRequired, royaltyBasisPoints)
      .accounts({
        license: licensePda,
        authority,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  }

  async transfer(
    promptAddress: PublicKey,
    newAuthority: PublicKey,
  ): Promise<TransactionSignature> {
    return this.program.methods
      .transfer(newAuthority)
      .accounts({
        prompt: promptAddress,
        currentAuthority: this.provider.wallet.publicKey,
      })
      .rpc();
  }

  async usePrompt(
    promptAddress: PublicKey,
    maxRoyaltyPayment: BN,
    licenseAddress?: PublicKey,
  ): Promise<TransactionSignature> {
    const accounts: Record<string, PublicKey> = {
      prompt: promptAddress,
      payer: this.provider.wallet.publicKey,
      licenseAuthority: this.provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    };
    if (licenseAddress) {
      accounts.license = licenseAddress;
    }

    return this.program.methods
      .usePrompt(maxRoyaltyPayment)
      .accounts(accounts)
      .rpc();
  }

  // --- Read operations ---

  async fetchPrompt(address: PublicKey): Promise<any> {
    return this.program.account.prompt.fetch(address);
  }

  async fetchVersion(address: PublicKey): Promise<any> {
    return this.program.account.promptVersion.fetch(address);
  }

  async fetchLicense(address: PublicKey): Promise<any> {
    return this.program.account.license.fetch(address);
  }

  async fetchPromptsByAuthority(authority?: PublicKey): Promise<
    Array<{ publicKey: PublicKey; account: any }>
  > {
    const auth = authority || this.provider.wallet.publicKey;
    const prompts = await this.program.account.prompt.all([
      { memcmp: { offset: 0, bytes: auth.toBase58() } },
    ]);
    return prompts.map((p: any) => ({
      publicKey: p.publicKey,
      account: p.account,
    }));
  }

  // --- PromptFS operations ---

  async mountFs(
    mountPoint: string,
    options?: { createSample?: boolean; autoSync?: boolean },
  ): Promise<PromptFs> {
    this._fs = new PromptFs(mountPoint);
    await this._fs.mount(this as any, this.provider.wallet.publicKey, {
      createSampleOnInit: options?.createSample ?? false,
      autoSync: options?.autoSync ?? false,
    });
    return this._fs;
  }

  async unmountFs(): Promise<void> {
    if (this._fs) {
      await this._fs.unmount();
      this._fs = null;
    }
  }

  async syncDirectory(params: SyncDirectoryParams): Promise<SyncResult> {
    const authority = this.provider.wallet.publicKey;
    const promptFiles = await scanDirectoryTree(params.directory);
    const result: SyncResult = { published: 0, skipped: 0, errors: [] };
    const total = promptFiles.length;

    for (let i = 0; i < total; i++) {
      const pf = promptFiles[i];
      params.onProgress?.(i + 1, total);

      try {
        const existing = await this.fetchPromptsByAuthority(authority);
        const alreadyPublished = existing.some(
          (e) => e.account.ipfsCid === pf.cid,
        );

        if (alreadyPublished) {
          result.skipped++;
          continue;
        }

        const metadataUri = `file://${joinPath(pf.directory, pf.filename)}`;
        const sig = await this.publish({
          filePath: joinPath(pf.directory, pf.filename),
        });

        result.published++;
      } catch (err) {
        result.errors.push({
          file: pf.filename,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return result;
  }
}

function joinPath(...parts: string[]): string {
  return parts.join("/");
}

export function createClient(
  connection: Connection,
  keypair: Keypair,
): FullClient {
  const wallet = new Wallet(keypair);
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  return new FullClient(provider);
}
