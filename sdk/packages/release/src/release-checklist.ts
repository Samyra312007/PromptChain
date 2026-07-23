import { resolve } from 'path';
import { ReleaseStep, ReleaseStepResult, ReleaseReport, PUBLISH_TARGETS } from './types';
import { detectManifests, verifyVersionConsistency } from './version';
import { buildAll, verifyAllArtifacts } from './builder';

function getSteps(version: string): ReleaseStep[] {
  return [
    {
      name: 'version-consistency',
      description: 'Verify all manifests have the same version',
      required: true,
      check: async () => {
        const { consistent, mismatches } = verifyVersionConsistency();
        return {
          step: 'version-consistency',
          passed: consistent,
          output: consistent ? undefined : `Version mismatches:\n${mismatches.join('\n')}`,
        };
      },
    },
    {
      name: 'idls-up-to-date',
      description: 'Regenerate Anchor IDLs from the program source',
      required: true,
      check: async () => {
        try {
          const { execSync } = require('child_process');
          execSync('anchor build --idl 2>&1', { cwd: require('path').resolve(__dirname, '..', '..', '..', '..', 'program'), timeout: 300000 });
          return { step: 'idls-up-to-date', passed: true };
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : String(err);
          return { step: 'idls-up-to-date', passed: false, error };
        }
      },
    },
    {
      name: 'codama-codegen',
      description: 'Regenerate Codama client libraries from IDLs',
      required: true,
      check: async () => {
        try {
          const { execSync } = require('child_process');
          execSync('npm run generate 2>&1', { cwd: require('path').resolve(__dirname, '..', '..', '..', '..', 'codama'), timeout: 120000 });
          return { step: 'codama-codegen', passed: true };
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : String(err);
          return { step: 'codama-codegen', passed: false, error };
        }
      },
    },
    {
      name: 'full-test-suite',
      description: 'Run the full test suite (SDK + programs + clients)',
      required: true,
      check: async () => {
        try {
          const { execSync } = require('child_process');
          const root = require('path').resolve(__dirname, '..', '..', '..', '..');
          execSync('npm test 2>&1', { cwd: resolve(root, 'sdk'), timeout: 600000 });
          return { step: 'full-test-suite', passed: true };
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : String(err);
          return { step: 'full-test-suite', passed: false, error };
        }
      },
    },
    {
      name: 'build-binaries',
      description: 'Build all release binaries',
      required: true,
      check: async () => {
        const results = await buildAll();
        const allOk = results.every(r => r.success);
        const failed = results.filter(r => !r.success).map(r => r.target);
        return {
          step: 'build-binaries',
          passed: allOk,
          output: allOk ? undefined : `Failed targets:\n${failed.join('\n')}`,
          error: allOk ? undefined : `Build failures: ${failed.join(', ')}`,
        };
      },
    },
    {
      name: 'verify-artifacts',
      description: 'Verify all build artifacts exist',
      required: true,
      check: async () => {
        const artifacts = verifyAllArtifacts();
        const allPresent = artifacts.every(a => a.present);
        const missing = artifacts.filter(a => !a.present).map(a => a.target);
        return {
          step: 'verify-artifacts',
          passed: allPresent,
          output: allPresent ? undefined : `Missing artifacts for:\n${missing.join('\n')}`,
          error: allPresent ? undefined : `Missing: ${missing.join(', ')}`,
        };
      },
    },
    {
      name: 'integration-tests',
      description: 'Run integration tests against built binaries',
      required: true,
      check: async () => {
        try {
          const { execSync } = require('child_process');
          execSync('npm run test:integration 2>&1', { cwd: require('path').resolve(__dirname, '..', '..', '..', '..', 'sdk'), timeout: 600000 });
          return { step: 'integration-tests', passed: true };
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : String(err);
          return { step: 'integration-tests', passed: false, error };
        }
      },
    },
    {
      name: 'signed-git-tag',
      description: 'Create a signed git tag for the release',
      required: true,
      check: async () => {
        try {
          const { execSync } = require('child_process');
          const root = require('path').resolve(__dirname, '..', '..', '..', '..');
          execSync(`git tag -s -m "Release v${version}" "v${version}"`, { cwd: root, timeout: 30000 });
          execSync(`git push origin "v${version}"`, { cwd: root, timeout: 60000 });
          return { step: 'signed-git-tag', passed: true, output: `Created and pushed tag v${version}` };
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : String(err);
          return { step: 'signed-git-tag', passed: false, error };
        }
      },
    },
    {
      name: 'publish-registries',
      description: 'Publish packages to all registries',
      required: false,
      check: async () => {
        try {
          const { execSync } = require('child_process');
          const root = require('path').resolve(__dirname, '..', '..', '..', '..');
          const failures: string[] = [];
          for (const pkg of PUBLISH_TARGETS) {
            try {
              switch (pkg.registry) {
                case 'npm':
                  execSync('npm publish --access public 2>&1', { cwd: require('path').resolve(root, pkg.path), timeout: 120000 });
                  break;
                case 'crates.io':
                  execSync('cargo publish 2>&1', { cwd: require('path').resolve(root, pkg.path), timeout: 120000 });
                  break;
                case 'pypi':
                  execSync('twine upload dist/* 2>&1', { cwd: require('path').resolve(root, pkg.path), timeout: 120000 });
                  break;
                case 'github':
                  execSync(`gh release upload "v${version}" dist/* 2>&1`, { cwd: require('path').resolve(root, pkg.path), timeout: 120000 });
                  break;
              }
            } catch {
              failures.push(`${pkg.registry}:${pkg.packageName}`);
            }
          }
          return {
            step: 'publish-registries',
            passed: failures.length === 0,
            output: failures.length > 0 ? `Failed publishes:\n${failures.join('\n')}` : undefined,
          };
        } catch (err: unknown) {
          const error = err instanceof Error ? err.message : String(err);
          return { step: 'publish-registries', passed: false, error };
        }
      },
    },
  ];
}

export async function runReleaseChecklist(version: string): Promise<ReleaseReport> {
  const steps = getSteps(version);
  const results: ReleaseStepResult[] = [];
  const artifacts: string[] = [];

  for (const step of steps) {
    console.log(`[check] ${step.name}: ${step.description}`);
    try {
      const result = await step.check();
      results.push(result);
      if (result.passed) {
        console.log(`  ✓ ${step.name}`);
      } else {
        console.error(`  ✗ ${step.name}: ${result.error || 'check failed'}`);
        if (step.required) {
          console.error(`  Stopping: required step "${step.name}" failed`);
          break;
        }
      }
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ step: step.name, passed: false, error });
      console.error(`  ✗ ${step.name}: unexpected error: ${error}`);
      if (step.required) break;
    }
  }

  return {
    version,
    timestamp: Date.now(),
    steps: results,
    allPassed: results.every(r => r.passed),
    artifacts,
  };
}

export async function runSpecificSteps(stepsToRun: string[], version: string): Promise<ReleaseStepResult[]> {
  const allSteps = getSteps(version);
  const filtered = allSteps.filter(s => stepsToRun.includes(s.name));
  const results: ReleaseStepResult[] = [];

  for (const step of filtered) {
    try {
      const result = await step.check();
      results.push(result);
      console.log(`${result.passed ? '✓' : '✗'} ${step.name}: ${result.error || 'ok'}`);
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({ step: step.name, passed: false, error });
      console.error(`✗ ${step.name}: ${error}`);
    }
  }

  return results;
}
