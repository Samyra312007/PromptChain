import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { PublishTarget, PublishResult, PUBLISH_TARGETS } from './types';

const ROOT = resolve(__dirname, '..', '..', '..', '..');

interface PublishOptions {
  dryRun?: boolean;
  targets?: PublishTarget[];
}

function runCommand(cmd: string, cwd: string, timeoutMs = 120000): void {
  execSync(cmd, { cwd, timeout: timeoutMs, stdio: ['pipe', 'pipe', 'pipe'] });
}

async function publishNpm(target: PublishTarget, dryRun: boolean): Promise<PublishResult> {
  try {
    const cwd = resolve(ROOT, target.path);
    if (!existsSync(resolve(cwd, 'package.json'))) {
      return { target, success: false, error: `No package.json at ${target.path}` };
    }
    const dryRunFlag = dryRun ? '--dry-run' : '';
    runCommand(`npm publish --access public ${dryRunFlag}`, cwd);
    return { target, success: true };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { target, success: false, error };
  }
}

async function publishCratesIo(target: PublishTarget, dryRun: boolean): Promise<PublishResult> {
  try {
    const cwd = resolve(ROOT, target.path);
    if (!existsSync(resolve(cwd, 'Cargo.toml'))) {
      return { target, success: false, error: `No Cargo.toml at ${target.path}` };
    }
    const dryRunFlag = dryRun ? '--dry-run' : '';
    runCommand(`cargo publish ${dryRunFlag}`, cwd);
    return { target, success: true };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { target, success: false, error };
  }
}

async function publishPyPi(target: PublishTarget, dryRun: boolean): Promise<PublishResult> {
  try {
    const cwd = resolve(ROOT, target.path);
    const distDir = resolve(cwd, 'dist');
    if (!existsSync(distDir)) {
      runCommand('python -m build', cwd);
    }
    const dryRunFlag = dryRun ? '--repository-url https://test.pypi.org/legacy/' : '';
    runCommand(`twine upload ${dryRunFlag} dist/*`, cwd);
    return { target, success: true };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { target, success: false, error };
  }
}

async function publishGitHub(target: PublishTarget, dryRun: boolean): Promise<PublishResult> {
  try {
    const cwd = resolve(ROOT, target.path);
    const distDir = resolve(cwd, 'dist');
    const tag = `v${target.version}`;
    if (!dryRun) {
      if (existsSync(distDir)) {
        runCommand(`gh release upload "${tag}" dist/* --clobber`, cwd);
      }
      runCommand(`gh release create "${tag}" --generate-notes --title "${target.packageName} v${target.version}"`, ROOT);
    }
    return { target, success: true };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return { target, success: false, error };
  }
}

export async function publish(target: PublishTarget, options: PublishOptions = {}): Promise<PublishResult> {
  const dryRun = options.dryRun ?? false;

  switch (target.registry) {
    case 'npm':
      return publishNpm(target, dryRun);
    case 'crates.io':
      return publishCratesIo(target, dryRun);
    case 'pypi':
      return publishPyPi(target, dryRun);
    case 'github':
      return publishGitHub(target, dryRun);
  }
}

export async function publishAll(options: PublishOptions = {}): Promise<PublishResult[]> {
  const targets = options.targets || PUBLISH_TARGETS;
  const results: PublishResult[] = [];

  // Publish npm packages first, then cargo, then pypi, then github
  const order: Record<string, number> = { npm: 0, 'crates.io': 1, pypi: 2, github: 3 };
  const sorted = [...targets].sort((a, b) => (order[a.registry] ?? 99) - (order[b.registry] ?? 99));

  for (const target of sorted) {
    console.log(`Publishing ${target.registry}:${target.packageName} v${target.version}...`);
    const result = await publish(target, options);
    results.push(result);
    if (result.success) {
      console.log(`  ✓ ${target.registry}:${target.packageName}`);
    } else {
      console.error(`  ✗ ${target.registry}:${target.packageName} - ${result.error}`);
    }
  }

  return results;
}

export function getRegistryConfig(registry: PublishTarget['registry']): { tokenEnv: string; url?: string } {
  switch (registry) {
    case 'npm':
      return { tokenEnv: 'NPM_TOKEN' };
    case 'crates.io':
      return { tokenEnv: 'CARGO_REGISTRY_TOKEN', url: 'https://crates.io' };
    case 'pypi':
      return { tokenEnv: 'PYPI_TOKEN', url: 'https://pypi.org' };
    case 'github':
      return { tokenEnv: 'GITHUB_TOKEN', url: 'https://github.com' };
  }
}
