import { Command } from 'commander';
import { Prover, Verifier } from '@promptchain/zk-proofs';

export function registerProveCommand(program: Command): void {
  program
    .command('prove')
    .description('Generate or verify ZK quality proofs for prompt execution')
    .argument('<action>', 'create | verify | batch')
    .argument('[prompt-cid]', 'Prompt CID to prove execution for')
    .option('-o, --output <file>', 'Output proof to file')
    .option('-p, --proof <file>', 'Proof file to verify')
    .option('-m, --model <id>', 'Model used for execution')
    .option('--provider <name>', 'Model provider')
    .option('--batch-file <file>', 'JSON file with batch entries for batch proof')
    .action(async (action: string, promptCid: string | undefined, options: Record<string, any>) => {
      try {
        const prover = new Prover({
          defaultProvider: options.provider || 'openai',
          defaultModel: options.model || 'gpt-4o',
        });

        if (action === 'create') {
          if (!promptCid) {
            console.error('Error: prompt-cid argument is required for create action');
            process.exit(1);
          }
          const output = `verified-output-${Date.now()}`;
          const proof = await prover.createProof(promptCid, output, options.model, options.provider);

          const proofJson = JSON.stringify(proof, null, 2);
          if (options.output) {
            const fs = await import('fs');
            fs.writeFileSync(options.output, proofJson, 'utf-8');
            console.log(`Proof written to ${options.output}`);
          } else {
            console.log(proofJson);
          }
          console.log(`\nVerified execution of ${promptCid}`);
          console.log(`Model: ${proof.commitment.claim.model.provider}/${proof.commitment.claim.model.modelId}`);
          console.log(`Commitment: ${proof.commitment.commitmentHash.slice(0, 16)}...`);
        } else if (action === 'verify') {
          const proofFile = options.proof || options.output;
          if (!proofFile) {
            console.error('Error: --proof file is required for verify action');
            process.exit(1);
          }
          const fs = await import('fs');
          const proof = JSON.parse(fs.readFileSync(proofFile, 'utf-8'));

          const verifier = new Verifier();
          const result = await verifier.verify(proof);

          console.log(`\nVerification result: ${result.status}`);
          console.log(`Verified: ${result.verified}`);
          console.log('Checks:');
          console.log(`  Commitment: ${result.checks.commitmentMatch ? '✓' : '✗'}`);
          console.log(`  Signature:  ${result.checks.signatureValid ? '✓' : '✗'}`);
          console.log(`  Freshness:  ${result.checks.timestampFresh ? '✓' : '✗'}`);
        } else if (action === 'batch') {
          if (!options.batchFile) {
            console.error('Error: --batch-file is required for batch action');
            process.exit(1);
          }
          const fs = await import('fs');
          const entries = JSON.parse(fs.readFileSync(options.batchFile, 'utf-8'));
          const batch = await prover.createBatchProof(entries);

          const outputFile = options.output || 'batch-proof.json';
          fs.writeFileSync(outputFile, JSON.stringify(batch, null, 2), 'utf-8');
          console.log(`Batch proof created: ${batch.proofs.length} proofs`);
          console.log(`Merkle root: ${batch.root.slice(0, 16)}...`);
          console.log(`Written to ${outputFile}`);
        } else {
          console.error(`Unknown action: ${action}. Use create, verify, or batch.`);
          process.exit(1);
        }
      } catch (err) {
        console.error('Proof operation failed:', err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}
