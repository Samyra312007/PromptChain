import { Command } from 'commander';
import { PromptCompiler, modelTargets, getTarget } from '@promptchain/compiler';

export function registerCompileCommand(program: Command): void {
  program
    .command('compile')
    .description('Compile a prompt for a target model')
    .argument('<prompt>', 'Prompt text or file path')
    .option('-m, --model <id>', 'Target model ID (e.g. gpt-4o, claude-3-5-sonnet)')
    .option('-r, --role <role>', 'Role description (e.g. "expert Rust developer")')
    .option('-f, --format <format>', 'Instruction format (direct, chain-of-thought, few-shot)')
    .option('-l, --list', 'List available target models')
    .option('-o, --output <file>', 'Write compiled output to file')
    .option('--all', 'Compile for all recommended models')
    .action(async (prompt: string, options: Record<string, any>) => {
      try {
        if (options.list) {
          console.log('Available target models:');
          modelTargets.forEach((t) => {
            const rec = t.recommended ? ' ★ recommended' : '';
            console.log(`  ${t.modelId.padEnd(25)} ${t.provider.padEnd(12)} ${t.label}${rec}`);
          });
          return;
        }

        const compiler = new PromptCompiler();

        if (options.all) {
          const targets = modelTargets.filter((t) => t.recommended);
          const results = compiler.compileMulti(prompt, targets, {
            role: options.role,
            instructionFormat: options.format as any,
          });
          results.forEach((r) => {
            console.log(`\n=== ${r.target.label} ===`);
            console.log(`Tokens: ~${r.tokenEstimate}`);
            console.log(r.compiled);
            if (r.warnings.length > 0) {
              r.warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
            }
          });
          return;
        }

        const modelId = options.model || 'gpt-4o';
        const target = getTarget(modelId);
        if (!target) {
          console.error(`Unknown model: ${modelId}. Use --list to see available models.`);
          process.exit(1);
        }

        let promptText = prompt;
        if (prompt.startsWith('/') || prompt.startsWith('./') || prompt.startsWith('~/')) {
          const fs = await import('fs');
          promptText = fs.readFileSync(prompt, 'utf-8');
        }

        const result = compiler.compile(promptText, target, {
          role: options.role,
          instructionFormat: options.format as any,
        });

        if (options.output) {
          const fs = await import('fs');
          fs.writeFileSync(options.output, result.compiled, 'utf-8');
          console.log(`Written to ${options.output}`);
        } else {
          console.log(`\n=== ${result.target.label} (~${result.tokenEstimate} tokens) ===`);
          console.log(result.compiled);
        }

        if (result.warnings.length > 0) {
          result.warnings.forEach((w) => console.warn(`  ⚠ ${w}`));
        }
      } catch (err) {
        console.error('Compilation failed:', err instanceof Error ? err.message : err);
        process.exit(1);
      }
    });
}
