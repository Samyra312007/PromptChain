import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve } from 'path';
import { CiConfig, CiJob, CiStep, CiTarget, MULTI_ARCH_TARGETS } from './types';

const ROOT = resolve(__dirname, '..', '..', '..', '..');

type WorkflowConfig = {
  name: string;
  on: Record<string, unknown>;
  jobs: Record<string, {
    'runs-on': string;
    strategy?: {
      matrix: Record<string, string[]>;
      'fail-fast': boolean;
    };
    permissions?: Record<string, string>;
    steps: {
      name: string;
      uses?: string;
      run?: string;
      with?: Record<string, string>;
      env?: Record<string, string>;
      'working-directory'?: string;
    }[];
  }>;
};

function getSharedSteps(): CiStep[] {
  return [
    { name: 'Checkout repository', uses: 'actions/checkout@v4' },
    { name: 'Setup Node.js', uses: 'actions/setup-node@v4', with: { 'node-version': '20' } },
    { name: 'Install dependencies', run: 'npm ci', 'working-directory': 'sdk' },
  ];
}

export function generateBuildWorkflow(targets: CiTarget[] = MULTI_ARCH_TARGETS): string {
  const workflow: WorkflowConfig = {
    name: 'Build & Test',
    on: {
      push: { branches: ['main'] },
      pull_request: { branches: ['main'] },
      workflow_dispatch: {},
    },
    jobs: {},
  };

  // SDK build job
  workflow.jobs['sdk-build'] = {
    'runs-on': 'ubuntu-latest',
    steps: [
      { name: 'Checkout repository', uses: 'actions/checkout@v4' },
      { name: 'Setup Node.js', uses: 'actions/setup-node@v4', with: { 'node-version': '20' } },
      { name: 'Install dependencies', run: 'npm ci' },
      { name: 'Build SDK', run: 'npm run build' },
      { name: 'Run tests', run: 'npm test' },
      { name: 'Lint check', run: 'npm run lint' },
    ],
  };

  // Rust SDK build job
  workflow.jobs['rust-sdk-build'] = {
    'runs-on': 'ubuntu-latest',
    steps: [
      { name: 'Checkout repository', uses: 'actions/checkout@v4' },
      { name: 'Setup Rust', uses: 'dtolnay/rust-toolchain@stable', with: { toolchain: 'stable' } },
      { name: 'Build Rust SDK', run: 'cargo build --release', 'working-directory': 'sdk/packages/rust' },
      { name: 'Run Rust tests', run: 'cargo test', 'working-directory': 'sdk/packages/rust' },
    ],
  };

  // Solana program build + test
  workflow.jobs['program-build-test'] = {
    'runs-on': 'ubuntu-latest',
    steps: [
      { name: 'Checkout repository', uses: 'actions/checkout@v4' },
      { name: 'Setup Rust', uses: 'dtolnay/rust-toolchain@stable', with: { toolchain: 'stable' } },
      { name: 'Setup Solana', run: 'sh -c "$(curl -sSfL https://release.anza.xyz/v2.0.0/install)"' },
      { name: 'Build programs', run: 'make build', 'working-directory': 'program' },
      { name: 'Run program tests', run: 'make test', 'working-directory': 'program' },
    ],
  };

  // Python SDK build + test
  workflow.jobs['python-sdk-build'] = {
    'runs-on': 'ubuntu-latest',
    steps: [
      { name: 'Checkout repository', uses: 'actions/checkout@v4' },
      { name: 'Setup Python', uses: 'actions/setup-python@v5', with: { 'python-version': '3.11' } },
      { name: 'Install dependencies', run: 'pip install build pytest', 'working-directory': 'sdk/packages/python' },
      { name: 'Build Python SDK', run: 'python -m build', 'working-directory': 'sdk/packages/python' },
      { name: 'Run Python tests', run: 'pytest', 'working-directory': 'sdk/packages/python' },
    ],
  };

  // Multi-arch Rust builds (matrix)
  const matrixEntries = targets.map(t => `${t.os}-${t.arch}`);
  workflow.jobs['multi-arch-build'] = {
    'runs-on': '${{ matrix.os }}',
    strategy: {
      matrix: {
        target: matrixEntries,
        os: [...new Set(targets.map(t => t.os))],
        arch: [...new Set(targets.map(t => t.arch))],
      },
      'fail-fast': false,
    },
    steps: [
      { name: 'Checkout repository', uses: 'actions/checkout@v4' },
      { name: 'Setup Rust', uses: 'dtolnay/rust-toolchain@stable', with: { toolchain: 'stable' } },
      { name: 'Add target', run: 'rustup target add ${{ matrix.arch }}-unknown-linux-gnu || true' },
      { name: 'Cross-compile Rust SDK', run: 'cargo build --release --target ${{ matrix.arch }}-unknown-linux-gnu', 'working-directory': 'sdk/packages/rust' },
    ],
  };

  // Codama codegen check
  workflow.jobs['codama-codegen'] = {
    'runs-on': 'ubuntu-latest',
    steps: [
      { name: 'Checkout repository', uses: 'actions/checkout@v4' },
      { name: 'Setup Node.js', uses: 'actions/setup-node@v4', with: { 'node-version': '20' } },
      { name: 'Install Codama dependencies', run: 'npm ci', 'working-directory': 'codama' },
      { name: 'Generate clients', run: 'npm run generate', 'working-directory': 'codama' },
      { name: 'Verify no diff', run: 'git diff --exit-code' },
    ],
  };

  // VSCode extension
  workflow.jobs['vscode-extension'] = {
    'runs-on': 'ubuntu-latest',
    steps: [
      { name: 'Checkout repository', uses: 'actions/checkout@v4' },
      { name: 'Setup Node.js', uses: 'actions/setup-node@v4', with: { 'node-version': '20' } },
      { name: 'Install dependencies', run: 'npm ci', 'working-directory': 'extensions/vscode' },
      { name: 'Lint extension', run: 'npm run lint', 'working-directory': 'extensions/vscode' },
      { name: 'Package extension', run: 'npx vsce package --no-dependencies', 'working-directory': 'extensions/vscode' },
    ],
  };

  return generateYaml(workflow);
}

export function generateReleaseWorkflow(): string {
  const workflow: WorkflowConfig = {
    name: 'Release',
    on: {
      push: { tags: ['v*'] },
      workflow_dispatch: {
        inputs: {
          bump: {
            description: 'Version bump type',
            required: true,
            default: 'patch',
            type: 'choice',
            options: ['patch', 'minor', 'major'],
          },
        },
      },
    },
    jobs: {},
  };

  workflow.jobs['release-publish'] = {
    'runs-on': 'ubuntu-latest',
    steps: [
      { name: 'Checkout repository', uses: 'actions/checkout@v4' },
      { name: 'Setup Node.js', uses: 'actions/setup-node@v4', with: { 'node-version': '20' } },
      { name: 'Setup Rust', uses: 'dtolnay/rust-toolchain@stable', with: { toolchain: 'stable' } },
      { name: 'Setup Python', uses: 'actions/setup-python@v5', with: { 'python-version': '3.11' } },
      { name: 'Install dependencies', run: 'npm ci && pip install build twine' },
      { name: 'Run release checklist', run: 'npx ts-node sdk/packages/release/src/release-checklist.ts' },
      { name: 'Publish to npm', run: 'npm run publish:all', env: { NODE_AUTH_TOKEN: '${{ secrets.NPM_TOKEN }}' } },
      { name: 'Publish to crates.io', run: 'cargo publish -p promptchain', env: { CARGO_REGISTRY_TOKEN: '${{ secrets.CARGO_TOKEN }}' } },
      { name: 'Publish to PyPI', run: 'twine upload sdk/packages/python/dist/*', env: { TWINE_USERNAME: '__token__', TWINE_PASSWORD: '${{ secrets.PYPI_TOKEN }}' } },
      { name: 'Create GitHub Release', run: 'gh release create v${{github.ref_name}} --generate-notes' },
    ],
  };

  workflow.jobs['release-docker'] = {
    'runs-on': 'ubuntu-latest',
    steps: [
      { name: 'Checkout repository', uses: 'actions/checkout@v4' },
      { name: 'Build Docker image', run: 'docker build -t promptchain:latest .' },
      { name: 'Push to registry', run: 'docker push ghcr.io/promptchain/promptchain:latest', env: { DOCKER_USERNAME: '${{ github.actor }}', DOCKER_PASSWORD: '${{ secrets.GITHUB_TOKEN }}' } },
    ],
  };

  return generateYaml(workflow);
}

export function generatePrAgentWorkflow(): string {
  const workflow: WorkflowConfig = {
    name: 'PR Agent',
    on: {
      pull_request: { types: ['opened', 'synchronize', 'reopened'] },
      issue_comment: { types: ['created'] },
    },
    jobs: {},
  };

  workflow.jobs['pr-review'] = {
    'runs-on': 'ubuntu-latest',
    permissions: {
      'pull-requests': 'write',
      'issues': 'write',
      'contents': 'write',
    },
    steps: [
      { name: 'Checkout repository', uses: 'actions/checkout@v4' },
      { name: 'Setup Python', uses: 'actions/setup-python@v5', with: { 'python-version': '3.11' } },
      { name: 'Install PR Agent', run: 'pip install pr-agent' },
      { name: 'Run PR Agent', run: 'pr_agent --pr_url ${{ github.event.pull_request.html_url }}', env: { OPENAI_KEY: '${{ secrets.OPENAI_KEY }}', GITHUB_TOKEN: '${{ secrets.GITHUB_TOKEN }}' } },
    ],
  };

  return generateYaml(workflow);
}

function generateYaml(config: WorkflowConfig): string {
  const lines: string[] = [];
  lines.push(`name: ${config.name}`);
  lines.push('');
  lines.push('on:');
  appendYaml(lines, config.on, 2);

  lines.push('jobs:');
  for (const [jobName, job] of Object.entries(config.jobs)) {
    lines.push(`  ${jobName}:`);
    lines.push(`    runs-on: ${job['runs-on']}`);
    lines.push('');

    if (job.strategy) {
      lines.push('    strategy:');
      lines.push(`      fail-fast: ${job.strategy['fail-fast']}`);
      lines.push('      matrix:');
      for (const [key, values] of Object.entries(job.strategy.matrix)) {
        lines.push(`        ${key}: [${values.map(v => JSON.stringify(v)).join(', ')}]`);
      }
      lines.push('');
    }

    lines.push('    steps:');
    for (const step of job.steps) {
      lines.push(`      - name: ${step.name}`);
      if (step.uses) {
        lines.push(`        uses: ${step.uses}`);
      }
      if (step.run) {
        lines.push(`        run: ${step.run}`);
      }
      if (step.with && Object.keys(step.with).length > 0) {
        lines.push('        with:');
        for (const [key, value] of Object.entries(step.with)) {
          lines.push(`          ${key}: ${value}`);
        }
      }
      if (step.env && Object.keys(step.env).length > 0) {
        lines.push('        env:');
        for (const [key, value] of Object.entries(step.env)) {
          lines.push(`          ${key}: ${value}`);
        }
      }
      const wd = (step as Record<string, unknown>)['working-directory'] as string | undefined;
      if (wd) {
        lines.push(`        working-directory: ${wd}`);
      }
    }
  }

  return lines.join('\n') + '\n';
}

function appendYaml(lines: string[], obj: unknown, indent: number): void {
  const prefix = ' '.repeat(indent);
  if (typeof obj === 'string') {
    lines.push(`${prefix}${obj}`);
  } else if (Array.isArray(obj)) {
    for (const item of obj) {
      lines.push(`${prefix}- ${JSON.stringify(item)}`);
    }
  } else if (obj && typeof obj === 'object') {
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        lines.push(`${prefix}${key}: ${value}`);
      } else if (typeof value === 'boolean' || typeof value === 'number') {
        lines.push(`${prefix}${key}: ${value}`);
      } else if (Array.isArray(value)) {
        lines.push(`${prefix}${key}:`);
        for (const item of value) {
          if (typeof item === 'string') {
            lines.push(`${prefix}  - ${JSON.stringify(item)}`);
          } else if (item && typeof item === 'object') {
            lines.push(`${prefix}  - ${JSON.stringify(item)}`);
          }
        }
      } else if (value && typeof value === 'object') {
        lines.push(`${prefix}${key}:`);
        appendYaml(lines, value, indent + 2);
      } else {
        lines.push(`${prefix}${key}: ${value}`);
      }
    }
  }
}

export function writeWorkflows(): void {
  const workflowsDir = resolve(ROOT, '.github/workflows');
  if (!existsSync(workflowsDir)) {
    mkdirSync(workflowsDir, { recursive: true });
  }

  writeFileSync(resolve(workflowsDir, 'build.yml'), generateBuildWorkflow(), 'utf-8');
  writeFileSync(resolve(workflowsDir, 'release.yml'), generateReleaseWorkflow(), 'utf-8');
  writeFileSync(resolve(workflowsDir, 'pr-agent.yml'), generatePrAgentWorkflow(), 'utf-8');

  console.log('Generated CI workflows in .github/workflows/');
}
