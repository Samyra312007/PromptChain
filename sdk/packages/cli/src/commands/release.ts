import { bumpVersion, detectManifests, verifyVersionConsistency } from "@promptchain/release";
import { runReleaseChecklist, runSpecificSteps } from "@promptchain/release";
import { buildAll, verifyAllArtifacts } from "@promptchain/release";
import { writeWorkflows } from "@promptchain/release";
import { publishAll } from "@promptchain/release";

export async function releaseVersionCommand(
  bump: "patch" | "minor" | "major" | "prerelease",
  options: { dryRun?: boolean; skipPublish?: boolean },
): Promise<void> {
  console.log(`Preparing ${bump} release...`);

  // 1. Check version consistency
  const { consistent, mismatches } = verifyVersionConsistency();
  if (!consistent) {
    console.error("Version inconsistency detected:");
    for (const m of mismatches) console.error(`  ${m}`);
    if (!options.dryRun) {
      throw new Error("Version inconsistency");
    }
  }

  // 2. Bump version
  const results = bumpVersion(bump);
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.error("Version bump failures:");
    for (const f of failed) console.error(`  ${f.manifest}: ${f.error}`);
    if (!options.dryRun) process.exit(1);
  }
  const bumpedVersion = results[0]?.newVersion || "unknown";
  console.log(`Bumped version to ${bumpedVersion} across ${results.length} manifests`);

  // 3. Build all
  console.log("Building all packages...");
  const buildResults = await buildAll();
  const buildFailed = buildResults.filter(r => !r.success);
  if (buildFailed.length > 0) {
    console.error("Build failures:");
    for (const f of buildFailed) console.error(`  ${f.target}: ${f.error}`);
    if (!options.dryRun) process.exit(1);
  }
  console.log("All builds passed");

  // 4. Verify artifacts
  const artifacts = verifyAllArtifacts();
  const missing = artifacts.filter(a => !a.present);
  if (missing.length > 0) {
    console.error("Missing artifacts:");
    for (const m of missing) console.error(`  ${m.target}`);
    if (!options.dryRun) process.exit(1);
  }
  console.log("All artifacts present");

  // 5. Run release checklist
  const report = await runReleaseChecklist(bumpedVersion);
  console.log(`Release checklist: ${report.allPassed ? "ALL PASSED" : "SOME FAILED"}`);
  for (const step of report.steps) {
    console.log(`  ${step.passed ? "✓" : "✗"} ${step.step}${step.error ? ": " + step.error : ""}`);
  }

  if (!report.allPassed && !options.dryRun) {
    console.error("Release checklist failed, aborting");
    process.exit(1);
  }

  // 6. Publish (unless --skip-publish)
  if (!options.skipPublish && !options.dryRun) {
    console.log("Publishing all packages...");
    const publishResults = await publishAll({ dryRun: false });
    const publishFailed = publishResults.filter(r => !r.success);
    if (publishFailed.length > 0) {
      console.error("Publish failures:");
      for (const f of publishFailed) console.error(`  ${f.target.registry}:${f.target.packageName} - ${f.error}`);
      process.exit(1);
    }
    console.log("All packages published");
  }

  if (options.dryRun) {
    console.log("Dry-run complete. No changes were published.");
  } else {
    console.log(`Release v${bumpedVersion} complete!`);
  }
}

export async function releaseChecklistCommand(options: { version?: string; steps?: string }): Promise<void> {
  const version = options.version || "0.1.0";
  if (options.steps) {
    const steps = options.steps.split(",").map(s => s.trim());
    const results = await runSpecificSteps(steps, version);
    const allPassed = results.every(r => r.passed);
    console.log(allPassed ? "All specified steps passed" : "Some steps failed");
  } else {
    const report = await runReleaseChecklist(version);
    console.log(`Checklist ${report.allPassed ? "PASSED" : "FAILED"}`);
  }
}

export async function releaseBumpCommand(
  bump: "patch" | "minor" | "major" | "prerelease",
  options: { dryRun?: boolean },
): Promise<void> {
  const results = bumpVersion(bump);
  const version = results[0]?.newVersion || "unknown";
  console.log(`Version bumped to ${version} (${bump})`);
  const failed = results.filter(r => !r.success);
  if (failed.length > 0) {
    console.error("Some bumps failed:");
    for (const f of failed) console.error(`  ${f.manifest}: ${f.error}`);
    if (!options.dryRun) process.exit(1);
  }
}

export async function releaseBuildCommand(options: { target?: string }): Promise<void> {
  if (options.target) {
    const target = require("../../release/src/types").BUILD_TARGETS.find(
      (t: { name: string }) => t.name === options.target,
    );
    if (!target) {
      console.error(`Unknown build target: ${options.target}`);
      process.exit(1);
    }
    const result = await buildAll([target]);
    console.log(result[0].success ? `Build OK (${result[0].durationMs}ms)` : `Build FAILED: ${result[0].error}`);
  } else {
    const results = await buildAll();
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) {
      console.error(`Build complete with ${failed.length} failures`);
      process.exit(1);
    }
    console.log("All builds passed");
  }
}

export async function releaseCiCommand(): Promise<void> {
  writeWorkflows();
  console.log("Generated CI workflows in .github/workflows/");
}

export async function releaseVersionShowCommand(): Promise<void> {
  const manifests = detectManifests();
  const { consistent, mismatches } = verifyVersionConsistency();
  console.log(`Version consistency: ${consistent ? "CONSISTENT" : "INCONSISTENT"}`);
  for (const m of manifests) {
    console.log(`  ${m.currentVersion}  ${m.path}`);
  }
  if (mismatches.length > 0) {
    console.log("\nMismatches:");
    for (const m of mismatches) console.log(`  ${m}`);
  }
}

export async function releasePublishCommand(options: { dryRun?: boolean; registry?: string }): Promise<void> {
  if (options.registry) {
    const targets = require("../../release/src/types").PUBLISH_TARGETS.filter(
      (t: { registry: string }) => t.registry === options.registry,
    );
    if (targets.length === 0) {
      console.error(`No publish targets for registry: ${options.registry}`);
      process.exit(1);
    }
    const results = await publishAll({ dryRun: options.dryRun ?? false, targets });
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) process.exit(1);
  } else {
    const results = await publishAll({ dryRun: options.dryRun ?? false });
    const failed = results.filter(r => !r.success);
    if (failed.length > 0) process.exit(1);
  }
}
