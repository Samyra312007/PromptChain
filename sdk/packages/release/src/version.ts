import { readFileSync, writeFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { ManifestInfo, VersionBumpResult, ALL_MANIFESTS } from './types';

const ROOT = resolve(__dirname, '..', '..', '..', '..');

function readManifest(path: string): string {
  const fullPath = resolve(ROOT, path);
  if (!existsSync(fullPath)) {
    throw new Error(`Manifest not found: ${fullPath}`);
  }
  return readFileSync(fullPath, 'utf-8');
}

function writeManifest(path: string, content: string): void {
  const fullPath = resolve(ROOT, path);
  writeFileSync(fullPath, content, 'utf-8');
}

function semverInc(version: string, bump: 'major' | 'minor' | 'patch' | 'prerelease'): string {
  let [base, pre] = version.split('-');
  const parts = base.split('.').map(Number);
  if (parts.length < 3) throw new Error(`Invalid semver: ${version}`);
  let [major, minor, patch] = parts;
  switch (bump) {
    case 'major': return `${major + 1}.0.0`;
    case 'minor': return `${major}.${minor + 1}.0`;
    case 'patch': return `${major}.${minor}.${patch + 1}`;
    case 'prerelease':
      if (pre !== undefined) {
        const preNum = parseInt(pre, 10) || 0;
        return `${major}.${minor}.${patch}-${preNum + 1}`;
      }
      return `${major}.${minor}.${patch}-1`;
  }
}

function getVersionFromContent(content: string, type: ManifestInfo['type']): string | null {
  switch (type) {
    case 'package.json': {
      const json = JSON.parse(content);
      return json.version || null;
    }
    case 'Cargo.toml': {
      const m = content.match(/^version\s*=\s*"([^"]+)"/m);
      return m ? m[1] : null;
    }
    case 'pyproject.toml': {
      const m = content.match(/^version\s*=\s*"([^"]+)"/m);
      return m ? m[1] : null;
    }
  }
}

function setVersionInContent(content: string, type: ManifestInfo['type'], newVersion: string): string {
  switch (type) {
    case 'package.json': {
      const json = JSON.parse(content);
      json.version = newVersion;
      return JSON.stringify(json, null, 2) + '\n';
    }
    case 'Cargo.toml': {
      return content.replace(/^(version\s*=\s*)"[^"]+"/m, `$1"${newVersion}"`);
    }
    case 'pyproject.toml': {
      return content.replace(/^(version\s*=\s*)"[^"]+"/m, `$1"${newVersion}"`);
    }
  }
}

function findWorkspaceDependents(path: string): ManifestInfo[] {
  const dir = path.split('/').slice(0, -1).join('/');
  const pkgName = path.endsWith('package.json')
    ? `@promptchain/${dir.split('/').pop()}`
    : null;
  if (!pkgName) return [];
  const dependents: ManifestInfo[] = [];
  for (const m of ALL_MANIFESTS) {
    if (m.path === path) continue;
    if (m.type !== 'package.json') continue;
    const content = readManifest(m.path);
    const json = JSON.parse(content);
    const deps = { ...json.dependencies, ...json.devDependencies, ...json.peerDependencies };
    if (deps[pkgName]) {
      dependents.push(m);
    }
  }
  return dependents;
}

export function getCurrentVersion(): string {
  const pkgPath = resolve(ROOT, 'sdk/packages/release/package.json');
  const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));
  return pkg.version;
}

export function detectManifests(): ManifestInfo[] {
  const results: ManifestInfo[] = [];
  for (const info of ALL_MANIFESTS) {
    try {
      const content = readManifest(info.path);
      const version = getVersionFromContent(content, info.type);
      if (version) {
        results.push({ ...info, currentVersion: version });
      }
    } catch {
      // skip missing manifests
    }
  }
  return results;
}

export function bumpVersion(bump: 'major' | 'minor' | 'patch' | 'prerelease' = 'patch'): VersionBumpResult[] {
  const results: VersionBumpResult[] = [];
  const manifests = detectManifests();
  const newVersion = semverInc(getCurrentVersion(), bump);

  const processed = new Set<string>();
  for (const manifest of manifests) {
    if (processed.has(manifest.path)) continue;
    processed.add(manifest.path);

    try {
      const content = readManifest(manifest.path);
      const updated = setVersionInContent(content, manifest.type, newVersion);
      writeManifest(manifest.path, updated);

      // Update workspace dependents' references
      const dependents = findWorkspaceDependents(manifest.path);
      for (const dep of dependents) {
        if (processed.has(dep.path)) continue;
        processed.add(dep.path);
        const depContent = readManifest(dep.path);
        const depJson = JSON.parse(depContent);
        const pkgName = `@promptchain/${manifest.path.split('/').slice(-2, -1)[0]}`;
        if (depJson.dependencies?.[pkgName]) {
          depJson.dependencies[pkgName] = `^${newVersion}`;
        }
        if (depJson.devDependencies?.[pkgName]) {
          depJson.devDependencies[pkgName] = `^${newVersion}`;
        }
        writeManifest(dep.path, JSON.stringify(depJson, null, 2) + '\n');
        results.push({
          manifest: dep.path,
          oldVersion: manifest.currentVersion,
          newVersion,
          success: true,
        });
      }

      results.push({
        manifest: manifest.path,
        oldVersion: manifest.currentVersion,
        newVersion,
        success: true,
      });
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      results.push({
        manifest: manifest.path,
        oldVersion: manifest.currentVersion,
        newVersion,
        success: false,
        error,
      });
    }
  }

  return results;
}

export function verifyVersionConsistency(): { consistent: boolean; mismatches: string[] } {
  const manifests = detectManifests();
  const versions = manifests.map(m => m.currentVersion);
  const unique = new Set(versions);
  const mismatches: string[] = [];

  if (unique.size > 1) {
    for (const m of manifests) {
      if (m.currentVersion !== versions[0]) {
        mismatches.push(`${m.path}: ${m.currentVersion} (expected ${versions[0]})`);
      }
    }
  }

  return {
    consistent: unique.size <= 1,
    mismatches,
  };
}

export function semverIncFn(version: string, bump: 'major' | 'minor' | 'patch' | 'prerelease'): string {
  return semverInc(version, bump);
}
