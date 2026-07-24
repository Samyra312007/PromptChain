export * from "./prompt-file";
export * from "./promptfs";
export * from "./ipfs";
export * from "./garbage-collector";
export * from "./arweave";

export * from "./types";
export * from "./provider-interface";
export { StorageManager, type ProviderFactory } from "./storage-manager";

export { LocalStorageProvider } from "./providers/local";
export { IpfsStorageProvider } from "./providers/ipfs-provider";
export { ArweaveStorageProvider } from "./providers/arweave-provider";
export { S3StorageProvider } from "./providers/s3";
export { FilecoinStorageProvider } from "./providers/filecoin";
export { CompositeStorageProvider, isComposite } from "./providers/composite";

export const STORAGE_VERSION = "0.1.0";
