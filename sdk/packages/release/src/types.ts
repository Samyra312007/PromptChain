export interface ManifestInfo {
  path: string;
  type: 'package.json' | 'Cargo.toml' | 'pyproject.toml';
  currentVersion: string;
}

export interface VersionBumpResult {
  manifest: string;
  oldVersion: string;
  newVersion: string;
  success: boolean;
  error?: string;
}

export interface BuildTarget {
  name: string;
  type: 'cargo' | 'npm' | 'python';
  path: string;
  distPath: string;
  artifacts: string[];
}

export interface BuildResult {
  target: string;
  success: boolean;
  durationMs: number;
  output?: string;
  error?: string;
}

export interface ReleaseStep {
  name: string;
  description: string;
  required: boolean;
  check: () => Promise<ReleaseStepResult>;
  run?: () => Promise<ReleaseStepResult>;
}

export interface ReleaseStepResult {
  step: string;
  passed: boolean;
  output?: string;
  error?: string;
}

export interface ReleaseReport {
  version: string;
  timestamp: number;
  steps: ReleaseStepResult[];
  allPassed: boolean;
  artifacts: string[];
}

export interface CiTarget {
  os: string;
  arch: string;
  runner: string;
  toolchain: string;
  targetDir: string;
}

export interface CiConfig {
  name: string;
  on: CiTrigger;
  jobs: CiJob[];
}

export interface CiTrigger {
  push?: { branches: string[] };
  pull_request?: { branches: string[] };
  workflow_dispatch?: Record<string, unknown>;
  schedule?: { cron: string }[];
}

export interface CiJob {
  name: string;
  runsOn: string;
  strategy?: CiStrategy;
  steps: CiStep[];
}

export interface CiStrategy {
  matrix: Record<string, string[]>;
  failFast: boolean;
}

export interface CiStep {
  name: string;
  uses?: string;
  run?: string;
  with?: Record<string, string>;
  env?: Record<string, string>;
  workingDirectory?: string;
  'working-directory'?: string;
}

export interface PublishTarget {
  registry: 'npm' | 'crates.io' | 'pypi' | 'github';
  packageName: string;
  path: string;
  version: string;
  requiresBuild: boolean;
}

export interface PublishResult {
  target: PublishTarget;
  success: boolean;
  error?: string;
}

export const ALL_MANIFESTS: ManifestInfo[] = [
  { path: 'sdk/packages/schema/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/client/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/storage/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/curation/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/token-economics/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/governance/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/indexer/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/cache/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/network/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/compiler/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/zk-proofs/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/rlhf/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/cli/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/testing/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/monitoring/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/backup/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'sdk/packages/release/package.json', type: 'package.json', currentVersion: '0.1.0' },
  { path: 'program/programs/promptchain/Cargo.toml', type: 'Cargo.toml', currentVersion: '0.1.0' },
  { path: 'program/programs/curation/Cargo.toml', type: 'Cargo.toml', currentVersion: '0.1.0' },
  { path: 'program/programs/token-economics/Cargo.toml', type: 'Cargo.toml', currentVersion: '0.1.0' },
  { path: 'program/programs/governance/Cargo.toml', type: 'Cargo.toml', currentVersion: '0.1.0' },
  { path: 'program/programs/promptchain-rlhf/Cargo.toml', type: 'Cargo.toml', currentVersion: '0.1.0' },
  { path: 'sdk/packages/rust/Cargo.toml', type: 'Cargo.toml', currentVersion: '0.1.0' },
  { path: 'sdk/packages/python/pyproject.toml', type: 'pyproject.toml', currentVersion: '0.1.0' },
  { path: 'extensions/vscode/package.json', type: 'package.json', currentVersion: '0.1.0' },
];

export const BUILD_TARGETS: BuildTarget[] = [
  { name: 'program-promptchain', type: 'cargo', path: 'program/programs/promptchain', distPath: 'program/target/deploy', artifacts: ['promptchain.so'] },
  { name: 'program-curation', type: 'cargo', path: 'program/programs/curation', distPath: 'program/target/deploy', artifacts: ['promptchain_curation.so'] },
  { name: 'program-token-economics', type: 'cargo', path: 'program/programs/token-economics', distPath: 'program/target/deploy', artifacts: ['promptchain_token_economics.so'] },
  { name: 'program-governance', type: 'cargo', path: 'program/programs/governance', distPath: 'program/target/deploy', artifacts: ['promptchain_governance.so'] },
  { name: 'program-rlhf', type: 'cargo', path: 'program/programs/promptchain-rlhf', distPath: 'program/target/deploy', artifacts: ['promptchain_rlhf.so'] },
  { name: 'sdk-rust', type: 'cargo', path: 'sdk/packages/rust', distPath: 'sdk/packages/rust/target/release', artifacts: ['libpromptchain.rlib'] },
  { name: 'sdk-schema', type: 'npm', path: 'sdk/packages/schema', distPath: 'sdk/packages/schema/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-client', type: 'npm', path: 'sdk/packages/client', distPath: 'sdk/packages/client/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-storage', type: 'npm', path: 'sdk/packages/storage', distPath: 'sdk/packages/storage/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-cache', type: 'npm', path: 'sdk/packages/cache', distPath: 'sdk/packages/cache/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-network', type: 'npm', path: 'sdk/packages/network', distPath: 'sdk/packages/network/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-curation', type: 'npm', path: 'sdk/packages/curation', distPath: 'sdk/packages/curation/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-token-economics', type: 'npm', path: 'sdk/packages/token-economics', distPath: 'sdk/packages/token-economics/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-governance', type: 'npm', path: 'sdk/packages/governance', distPath: 'sdk/packages/governance/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-indexer', type: 'npm', path: 'sdk/packages/indexer', distPath: 'sdk/packages/indexer/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-compiler', type: 'npm', path: 'sdk/packages/compiler', distPath: 'sdk/packages/compiler/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-zk-proofs', type: 'npm', path: 'sdk/packages/zk-proofs', distPath: 'sdk/packages/zk-proofs/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-rlhf', type: 'npm', path: 'sdk/packages/rlhf', distPath: 'sdk/packages/rlhf/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-cli', type: 'npm', path: 'sdk/packages/cli', distPath: 'sdk/packages/cli/dist', artifacts: ['index.js'] },
  { name: 'sdk-testing', type: 'npm', path: 'sdk/packages/testing', distPath: 'sdk/packages/testing/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-monitoring', type: 'npm', path: 'sdk/packages/monitoring', distPath: 'sdk/packages/monitoring/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-backup', type: 'npm', path: 'sdk/packages/backup', distPath: 'sdk/packages/backup/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'sdk-release', type: 'npm', path: 'sdk/packages/release', distPath: 'sdk/packages/release/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'client-ts', type: 'npm', path: 'clients/ts', distPath: 'clients/ts/dist', artifacts: ['index.js', 'index.d.ts'] },
  { name: 'vscode-extension', type: 'npm', path: 'extensions/vscode', distPath: 'extensions/vscode/out', artifacts: ['extension.js'] },
  { name: 'codama', type: 'npm', path: 'codama', distPath: 'codama/dist', artifacts: ['generated'] },
];

export const MULTI_ARCH_TARGETS: CiTarget[] = [
  { os: 'ubuntu-latest', arch: 'x86_64', runner: 'ubuntu-latest', toolchain: 'stable', targetDir: 'target/x86_64-unknown-linux-gnu' },
  { os: 'ubuntu-latest', arch: 'aarch64', runner: 'ubuntu-latest', toolchain: 'stable', targetDir: 'target/aarch64-unknown-linux-gnu' },
  { os: 'macos-latest', arch: 'x86_64', runner: 'macos-13', toolchain: 'stable', targetDir: 'target/x86_64-apple-darwin' },
  { os: 'macos-latest', arch: 'aarch64', runner: 'macos-latest', toolchain: 'stable', targetDir: 'target/aarch64-apple-darwin' },
  { os: 'windows-latest', arch: 'x86_64', runner: 'windows-latest', toolchain: 'stable', targetDir: 'target/x86_64-pc-windows-msvc' },
];

export const RELEASE_VERSION = '0.1.0';

export const PUBLISH_TARGETS: PublishTarget[] = [
  { registry: 'npm', packageName: '@promptchain/schema', path: 'sdk/packages/schema', version: '0.1.0', requiresBuild: true },
  { registry: 'npm', packageName: '@promptchain/client', path: 'sdk/packages/client', version: '0.1.0', requiresBuild: true },
  { registry: 'npm', packageName: '@promptchain/storage', path: 'sdk/packages/storage', version: '0.1.0', requiresBuild: true },
  { registry: 'npm', packageName: '@promptchain/cli', path: 'sdk/packages/cli', version: '0.1.0', requiresBuild: true },
  { registry: 'npm', packageName: '@promptchain/monitoring', path: 'sdk/packages/monitoring', version: '0.1.0', requiresBuild: true },
  { registry: 'npm', packageName: '@promptchain/backup', path: 'sdk/packages/backup', version: '0.1.0', requiresBuild: true },
  { registry: 'crates.io', packageName: 'promptchain', path: 'program/programs/promptchain', version: '0.1.0', requiresBuild: true },
  { registry: 'pypi', packageName: 'promptchain-py', path: 'sdk/packages/python', version: '0.1.0', requiresBuild: true },
  { registry: 'github', packageName: 'promptchain-cli', path: 'sdk/packages/cli', version: '0.1.0', requiresBuild: true },
];
