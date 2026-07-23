import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { BuildResult, BuildTarget, BUILD_TARGETS } from './types';

const ROOT = resolve(__dirname, '..', '..', '..', '..');

function runCommand(cmd: string, cwd: string, timeoutMs = 600000): { stdout: string; stderr: string } {
  const stdout = execSync(cmd, {
    cwd,
    timeout: timeoutMs,
    encoding: 'utf-8',
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  return { stdout: stdout.toString(), stderr: '' };
}

async function buildCargoTarget(target: BuildTarget): Promise<BuildResult> {
  const start = Date.now();
  const cwd = resolve(ROOT);
  try {
    const manifestDir = resolve(ROOT, target.path);
    if (!existsSync(resolve(manifestDir, 'Cargo.toml'))) {
      return {
        target: target.name,
        success: false,
        durationMs: Date.now() - start,
        error: `Cargo.toml not found in ${target.path}`,
      };
    }
    runCommand('cargo build --release', manifestDir);
    return {
      target: target.name,
      success: true,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      target: target.name,
      success: false,
      durationMs: Date.now() - start,
      error,
    };
  }
}

async function buildNpmTarget(target: BuildTarget): Promise<BuildResult> {
  const start = Date.now();
  const cwd = resolve(ROOT, target.path);
  try {
    if (!existsSync(resolve(cwd, 'package.json'))) {
      return {
        target: target.name,
        success: false,
        durationMs: Date.now() - start,
        error: `package.json not found in ${target.path}`,
      };
    }
    runCommand('npm run build', cwd);
    return {
      target: target.name,
      success: true,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      target: target.name,
      success: false,
      durationMs: Date.now() - start,
      error,
    };
  }
}

async function buildPythonTarget(target: BuildTarget): Promise<BuildResult> {
  const start = Date.now();
  const cwd = resolve(ROOT, target.path);
  try {
    const setupPy = resolve(cwd, 'setup.py');
    const pyproject = resolve(cwd, 'pyproject.toml');
    if (!existsSync(setupPy) && !existsSync(pyproject)) {
      return {
        target: target.name,
        success: false,
        durationMs: Date.now() - start,
        error: `No setup.py or pyproject.toml found in ${target.path}`,
      };
    }
    runCommand('pip install build && python -m build --wheel', cwd);
    return {
      target: target.name,
      success: true,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    return {
      target: target.name,
      success: false,
      durationMs: Date.now() - start,
      error,
    };
  }
}

export async function buildTarget(target: BuildTarget): Promise<BuildResult> {
  switch (target.type) {
    case 'cargo':
      return buildCargoTarget(target);
    case 'npm':
      return buildNpmTarget(target);
    case 'python':
      return buildPythonTarget(target);
  }
}

export async function buildAll(
  targets?: BuildTarget[],
  concurrency = 4
): Promise<BuildResult[]> {
  const toBuild = targets || BUILD_TARGETS;
  const results: BuildResult[] = [];

  // Sort: cargo builds first (programs, then SDK rust), then npm builds
  const sorted = [...toBuild].sort((a, b) => {
    const order = { cargo: 0, npm: 1, python: 2 };
    return (order[a.type] ?? 99) - (order[b.type] ?? 99);
  });

  // Build sequentially, respecting inter-package dependencies
  for (const target of sorted) {
    console.log(`Building ${target.name} (${target.type})...`);
    const result = await buildTarget(target);
    results.push(result);
    if (!result.success) {
      console.error(`  FAILED: ${target.name} - ${result.error}`);
    } else {
      console.log(`  OK (${result.durationMs}ms)`);
    }
  }

  return results;
}

export function verifyArtifacts(target: BuildTarget): boolean {
  const distPath = resolve(ROOT, target.distPath);
  if (!existsSync(distPath)) return false;
  for (const artifact of target.artifacts) {
    if (!existsSync(resolve(distPath, artifact))) return false;
  }
  return true;
}

export function verifyAllArtifacts(targets?: BuildTarget[]): { target: string; present: boolean }[] {
  return (targets || BUILD_TARGETS).map(t => ({
    target: t.name,
    present: verifyArtifacts(t),
  }));
}
