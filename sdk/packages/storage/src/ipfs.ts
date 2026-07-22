import { createHash } from "crypto";
import { readFile } from "fs/promises";
import { spawn, ChildProcess } from "child_process";
import { EventEmitter } from "events";

export interface IpfsConfig {
  apiUrl: string;
  gatewayUrl: string;
  binaryPath: string;
  repoPath: string;
}

export const DEFAULT_IPFS_CONFIG: IpfsConfig = {
  apiUrl: "http://127.0.0.1:5001",
  gatewayUrl: "http://127.0.0.1:8080",
  binaryPath: "ipfs",
  repoPath: "~/.ipfs",
};

export type IpfsDaemonEvent = "started" | "stopped" | "error" | "ready";

export class IpfsDaemonManager extends EventEmitter {
  private process: ChildProcess | null = null;
  private _running = false;
  private config: IpfsConfig;

  constructor(config: Partial<IpfsConfig> = {}) {
    super();
    this.config = { ...DEFAULT_IPFS_CONFIG, ...config };
  }

  get running(): boolean {
    return this._running;
  }

  async start(): Promise<void> {
    if (this._running) return;

    return new Promise((resolve, reject) => {
      const proc = spawn(this.config.binaryPath, ["daemon"], {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, IPFS_PATH: this.config.repoPath },
      });

      this.process = proc;
      this._running = true;
      this.emit("started");

      proc.stdout?.on("data", (data: Buffer) => {
        const msg = data.toString();
        if (msg.includes("Daemon is ready")) {
          this.emit("ready");
          resolve();
        }
      });

      proc.stderr?.on("data", (data: Buffer) => {
        const msg = data.toString();
        if (msg.includes("Daemon is ready")) {
          this.emit("ready");
          resolve();
        }
      });

      proc.on("error", (err) => {
        this._running = false;
        this.emit("error", err);
        reject(err);
      });

      proc.on("exit", (code) => {
        this._running = false;
        this.process = null;
        this.emit("stopped", code);
      });

      setTimeout(() => {
        if (this._running) {
          resolve();
        }
      }, 5000);
    });
  }

  async stop(): Promise<void> {
    if (!this._running || !this.process) return;
    this.process.kill("SIGTERM");
    return new Promise((resolve) => {
      this.once("stopped", () => resolve());
      setTimeout(() => resolve(), 3000);
    });
  }

  async add(content: Buffer | string): Promise<string> {
    const data = typeof content === "string" ? Buffer.from(content, "utf8") : content;
    const url = `${this.config.apiUrl}/api/v0/add`;
    const formData = new FormData();
    const blob = new Blob([data]);
    formData.append("file", blob, "prompt.txt");

    const response = await fetch(url, { method: "POST", body: formData });
    if (!response.ok) {
      throw new Error(`IPFS add failed: ${response.statusText}`);
    }

    const result = await response.json() as { Hash: string };
    return result.Hash;
  }

  async cat(cid: string): Promise<Buffer> {
    const url = `${this.config.apiUrl}/api/v0/cat?arg=${cid}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`IPFS cat failed: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async pin(cid: string): Promise<void> {
    const url = `${this.config.apiUrl}/api/v0/pin/add?arg=${cid}`;
    const response = await fetch(url, { method: "POST" });
    if (!response.ok) {
      throw new Error(`IPFS pin failed: ${response.statusText}`);
    }
  }

  async unpin(cid: string): Promise<void> {
    const url = `${this.config.apiUrl}/api/v0/pin/rm?arg=${cid}`;
    const response = await fetch(url, { method: "POST" });
    if (!response.ok) {
      throw new Error(`IPFS unpin failed: ${response.statusText}`);
    }
  }

  async resolve(cid: string): Promise<string> {
    const url = `${this.config.apiUrl}/api/v0/resolve?arg=${cid}`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`IPFS resolve failed: ${response.statusText}`);
    }
    const result = await response.json() as { Path: string };
    return result.Path;
  }

  gatewayUrl(cid: string): string {
    return `${this.config.gatewayUrl}/ipfs/${cid}`;
  }
}

export class IpfsContentManager {
  private daemon: IpfsDaemonManager;

  constructor(daemon: IpfsDaemonManager) {
    this.daemon = daemon;
  }

  async storePrompt(
    promptText: string,
    metadataJson: string,
  ): Promise<{ promptCid: string; metadataCid: string; combinedCid: string }> {
    const promptCid = await this.daemon.add(promptText);
    const metadataCid = await this.daemon.add(metadataJson);

    const manifest = JSON.stringify({
      prompt: promptCid,
      metadata: metadataCid,
      version: "1.0",
      created_at: new Date().toISOString(),
    });
    const combinedCid = await this.daemon.add(manifest);

    await this.daemon.pin(combinedCid);
    return { promptCid, metadataCid, combinedCid };
  }

  async retrievePrompt(
    combinedCid: string,
  ): Promise<{ promptText: string; metadata: string }> {
    const manifestBuf = await this.daemon.cat(combinedCid);
    const manifest = JSON.parse(manifestBuf.toString("utf8"));
    const promptText = (await this.daemon.cat(manifest.prompt)).toString("utf8");
    const metadata = (await this.daemon.cat(manifest.metadata)).toString("utf8");
    return { promptText, metadata };
  }
}
