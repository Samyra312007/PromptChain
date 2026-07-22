"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FullClient = void 0;
exports.createClient = createClient;
const web3_js_1 = require("@solana/web3.js");
const anchor_1 = require("@coral-xyz/anchor");
const crypto_1 = require("crypto");
const schema_1 = require("@promptchain/schema");
const storage_1 = require("@promptchain/storage");
const promptchain_json_1 = __importDefault(require("./idl/promptchain.json"));
class FullClient {
    constructor(provider) {
        this._fs = null;
        this.provider = provider;
        this.program = new anchor_1.Program(promptchain_json_1.default, provider);
    }
    get programId() {
        return this.program.programId;
    }
    get fs() {
        return this._fs;
    }
    // --- PDA helpers ---
    findPromptPda(cid) {
        const cidHash = (0, crypto_1.createHash)("sha256").update(cid, "utf8").digest();
        return web3_js_1.PublicKey.findProgramAddressSync([schema_1.PDA_SEEDS.PROMPT, cidHash], new web3_js_1.PublicKey(schema_1.PROMPTCHAIN_PROGRAM_ID));
    }
    findVersionPda(prompt, versionNumber) {
        const buf = Buffer.alloc(4);
        buf.writeUInt32LE(versionNumber);
        return web3_js_1.PublicKey.findProgramAddressSync([schema_1.PDA_SEEDS.VERSION, prompt.toBuffer(), buf], new web3_js_1.PublicKey(schema_1.PROMPTCHAIN_PROGRAM_ID));
    }
    findLicensePda(name) {
        return web3_js_1.PublicKey.findProgramAddressSync([schema_1.PDA_SEEDS.LICENSE, this.provider.wallet.publicKey.toBuffer(), Buffer.from(name)], new web3_js_1.PublicKey(schema_1.PROMPTCHAIN_PROGRAM_ID));
    }
    // --- On-chain operations ---
    async publish(params) {
        let cid;
        let metadataUri;
        let license;
        const authority = this.provider.wallet.publicKey;
        if ("filePath" in params) {
            const pf = await (0, storage_1.readPromptFile)(params.filePath);
            cid = pf.cid;
            metadataUri = `file://${params.filePath}`;
            license = params.license;
        }
        else {
            cid = (0, storage_1.computeCid)(params.promptText);
            metadataUri = `prompt://${params.name}`;
            license = params.license;
        }
        const [promptPda] = this.findPromptPda(cid);
        const signature = await this.program.methods
            .publish(cid, metadataUri, license ?? null)
            .accounts({
            prompt: promptPda,
            authority,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
        return { signature, promptAddress: promptPda, cid };
    }
    async createVersion(params) {
        const pf = await (0, storage_1.readPromptFile)(params.filePath);
        const cid = pf.cid;
        const metadataUri = `file://${params.filePath}`;
        const authority = this.provider.wallet.publicKey;
        const promptAccount = await this.program.account.prompt.fetch(params.promptAddress);
        const versionNumber = promptAccount.totalVersions;
        const [versionPda] = this.findVersionPda(params.promptAddress, versionNumber);
        return this.program.methods
            .createVersion(cid, metadataUri, params.changelogUri)
            .accounts({
            prompt: params.promptAddress,
            version: versionPda,
            authority,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
    }
    async setLicense(name, commercialAllowed, attributionRequired, royaltyBasisPoints) {
        const authority = this.provider.wallet.publicKey;
        const [licensePda] = this.findLicensePda(name);
        return this.program.methods
            .setLicense(name, commercialAllowed, attributionRequired, royaltyBasisPoints)
            .accounts({
            license: licensePda,
            authority,
            systemProgram: web3_js_1.SystemProgram.programId,
        })
            .rpc();
    }
    async transfer(promptAddress, newAuthority) {
        return this.program.methods
            .transfer(newAuthority)
            .accounts({
            prompt: promptAddress,
            currentAuthority: this.provider.wallet.publicKey,
        })
            .rpc();
    }
    async usePrompt(promptAddress, maxRoyaltyPayment, licenseAddress) {
        const accounts = {
            prompt: promptAddress,
            payer: this.provider.wallet.publicKey,
            licenseAuthority: this.provider.wallet.publicKey,
            systemProgram: web3_js_1.SystemProgram.programId,
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
    async fetchPrompt(address) {
        return this.program.account.prompt.fetch(address);
    }
    async fetchVersion(address) {
        return this.program.account.promptVersion.fetch(address);
    }
    async fetchLicense(address) {
        return this.program.account.license.fetch(address);
    }
    async fetchPromptsByAuthority(authority) {
        const auth = authority || this.provider.wallet.publicKey;
        const prompts = await this.program.account.prompt.all([
            { memcmp: { offset: 0, bytes: auth.toBase58() } },
        ]);
        return prompts.map((p) => ({
            publicKey: p.publicKey,
            account: p.account,
        }));
    }
    // --- PromptFS operations ---
    async mountFs(mountPoint, options) {
        this._fs = new storage_1.PromptFs(mountPoint);
        await this._fs.mount(this, this.provider.wallet.publicKey, {
            createSampleOnInit: options?.createSample ?? false,
            autoSync: options?.autoSync ?? false,
        });
        return this._fs;
    }
    async unmountFs() {
        if (this._fs) {
            await this._fs.unmount();
            this._fs = null;
        }
    }
    async syncDirectory(params) {
        const authority = this.provider.wallet.publicKey;
        const promptFiles = await (0, storage_1.scanDirectoryTree)(params.directory);
        const result = { published: 0, skipped: 0, errors: [] };
        const total = promptFiles.length;
        for (let i = 0; i < total; i++) {
            const pf = promptFiles[i];
            params.onProgress?.(i + 1, total);
            try {
                const existing = await this.fetchPromptsByAuthority(authority);
                const alreadyPublished = existing.some((e) => e.account.ipfsCid === pf.cid);
                if (alreadyPublished) {
                    result.skipped++;
                    continue;
                }
                const metadataUri = `file://${joinPath(pf.directory, pf.filename)}`;
                const sig = await this.publish({
                    filePath: joinPath(pf.directory, pf.filename),
                });
                result.published++;
            }
            catch (err) {
                result.errors.push({
                    file: pf.filename,
                    error: err instanceof Error ? err.message : String(err),
                });
            }
        }
        return result;
    }
}
exports.FullClient = FullClient;
function joinPath(...parts) {
    return parts.join("/");
}
function createClient(connection, keypair) {
    const wallet = new anchor_1.Wallet(keypair);
    const provider = new anchor_1.AnchorProvider(connection, wallet, {
        commitment: "confirmed",
    });
    return new FullClient(provider);
}
//# sourceMappingURL=index.js.map