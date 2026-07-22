import { PublicKey, Connection, TransactionSignature, Keypair } from "@solana/web3.js";
import { AnchorProvider, BN } from "@coral-xyz/anchor";
import { type PromptMetadata } from "@promptchain/schema";
import { PromptFs } from "@promptchain/storage";
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
    errors: Array<{
        file: string;
        error: string;
    }>;
}
export declare class FullClient {
    private program;
    private provider;
    private _fs;
    constructor(provider: AnchorProvider);
    get programId(): PublicKey;
    get fs(): PromptFs | null;
    findPromptPda(cid: string): [PublicKey, number];
    findVersionPda(prompt: PublicKey, versionNumber: number): [PublicKey, number];
    findLicensePda(name: string): [PublicKey, number];
    publish(params: PublishLocalParams | PublishTextParams): Promise<{
        signature: TransactionSignature;
        promptAddress: PublicKey;
        cid: string;
    }>;
    createVersion(params: CreateVersionLocalParams): Promise<TransactionSignature>;
    setLicense(name: string, commercialAllowed: boolean, attributionRequired: boolean, royaltyBasisPoints: number): Promise<TransactionSignature>;
    transfer(promptAddress: PublicKey, newAuthority: PublicKey): Promise<TransactionSignature>;
    usePrompt(promptAddress: PublicKey, maxRoyaltyPayment: BN, licenseAddress?: PublicKey): Promise<TransactionSignature>;
    fetchPrompt(address: PublicKey): Promise<any>;
    fetchVersion(address: PublicKey): Promise<any>;
    fetchLicense(address: PublicKey): Promise<any>;
    fetchPromptsByAuthority(authority?: PublicKey): Promise<Array<{
        publicKey: PublicKey;
        account: any;
    }>>;
    mountFs(mountPoint: string, options?: {
        createSample?: boolean;
        autoSync?: boolean;
    }): Promise<PromptFs>;
    unmountFs(): Promise<void>;
    syncDirectory(params: SyncDirectoryParams): Promise<SyncResult>;
}
export declare function createClient(connection: Connection, keypair: Keypair): FullClient;
//# sourceMappingURL=index.d.ts.map