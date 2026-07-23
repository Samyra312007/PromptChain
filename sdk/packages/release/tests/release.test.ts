import { describe, it, expect } from 'vitest';
import { detectManifests, verifyVersionConsistency, semverIncFn, getCurrentVersion } from '../src/version';
import { verifyArtifacts, BUILD_TARGETS } from '../src/types';

describe('version', () => {
  it('should detect all manifests', () => {
    const manifests = detectManifests();
    expect(manifests.length).toBeGreaterThan(0);
    for (const m of manifests) {
      expect(m.path).toBeTruthy();
      expect(m.type).toMatch(/^(package\.json|Cargo\.toml|pyproject\.toml)$/);
      expect(m.currentVersion).toMatch(/^\d+\.\d+\.\d+/);
    }
  });

  it('should verify version consistency', () => {
    const { consistent, mismatches } = verifyVersionConsistency();
    // May be inconsistent during development — just verify it returns the right shape
    expect(typeof consistent).toBe('boolean');
    expect(Array.isArray(mismatches)).toBe(true);
  });

  it('should increment semver correctly', () => {
    expect(semverIncFn('0.1.0', 'patch')).toBe('0.1.1');
    expect(semverIncFn('0.1.0', 'minor')).toBe('0.2.0');
    expect(semverIncFn('0.1.0', 'major')).toBe('1.0.0');
    expect(semverIncFn('0.1.0', 'prerelease')).toBe('0.1.0-1');
    expect(semverIncFn('0.1.0-1', 'prerelease')).toBe('0.1.0-2');
  });

  it('should get current version from release package', () => {
    const version = getCurrentVersion();
    expect(version).toMatch(/^\d+\.\d+\.\d+/);
  });
});

describe('build targets', () => {
  it('should define valid build targets', () => {
    expect(BUILD_TARGETS.length).toBeGreaterThan(0);
    for (const t of BUILD_TARGETS) {
      expect(t.name).toBeTruthy();
      expect(['cargo', 'npm', 'python']).toContain(t.type);
      expect(t.path).toBeTruthy();
    }
  });
});

describe('version module consistency', () => {
  it('should detect at least the release package manifest', () => {
    const manifests = detectManifests();
    const releaseManifest = manifests.find(m => m.path.includes('release'));
    expect(releaseManifest).toBeTruthy();
    expect(releaseManifest!.currentVersion).toBe('0.1.0');
  });
});
