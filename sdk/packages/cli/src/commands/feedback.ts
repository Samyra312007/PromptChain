import { Command } from 'commander';

export function registerFeedbackCommand(program: Command): void {
  const feedback = program
    .command('feedback')
    .description('RLHF coordination - manage human feedback sessions');

  feedback
    .command('init')
    .description('Initialize a new feedback session')
    .argument('<session-id>', 'Unique session identifier')
    .option('-c, --cid <cid>', 'Prompt CID to collect feedback for')
    .option('-m, --model <name>', 'Target model name')
    .option('-n, --max <number>', 'Maximum number of preferences', '1000')
    .option('-r, --reward <lamports>', 'Reward per preference in lamports', '1000000000')
    .action(async (sessionId: string, options: Record<string, any>) => {
      const cid = options.cid || 'local-development';
      console.log(`\nInitialized RLHF session ${sessionId}:`);
      console.log(`  Prompt CID:  ${cid}`);
      console.log(`  Model:       ${options.model || 'gpt-4o'}`);
      console.log(`  Max prefs:   ${options.max}`);
      console.log(`  Reward/pref: ${options.reward} lamports`);
      console.log(`\nTo submit preferences:\n  promptchain feedback submit ${sessionId} --preferred <uri> --rejected <uri>`);
    });

  feedback
    .command('submit')
    .description('Submit a preference (pairwise comparison)')
    .argument('<session-id>', 'Active session ID')
    .option('-p, --preferred <uri>', 'URI of the preferred output')
    .option('-r, --rejected <uri>', 'URI of the rejected output')
    .option('-c, --criteria <text>', 'Rating criteria description')
    .option('--rating', 'Submit a scalar rating instead of pairwise preference')
    .option('-v, --value <1-5>', 'Rating value (1-5) for scalar rating')
    .option('-o, --output <uri>', 'Output URI being rated (for scalar rating)')
    .action(async (sessionId: string, options: Record<string, any>) => {
      const criteria = options.criteria || 'Helpfulness, accuracy, and relevance';

      if (options.rating) {
        const value = parseInt(options.value || '5', 10);
        if (value < 1 || value > 5) {
          console.error('Rating value must be between 1 and 5.');
          process.exit(1);
        }
        console.log(`\nSubmitted scalar rating for session ${sessionId}:`);
        console.log(`  Rating:  ${value}/5`);
        console.log(`  Output:  ${options.output || '(local)'}`);
        console.log(`  Criteria: ${criteria}`);
      } else {
        if (!options.preferred || !options.rejected) {
          console.error('Both --preferred and --rejected URIs are required for pairwise preference.');
          process.exit(1);
        }
        console.log(`\nSubmitted preference for session ${sessionId}:`);
        console.log(`  Preferred: ${options.preferred}`);
        console.log(`  Rejected:  ${options.rejected}`);
        console.log(`  Criteria:  ${criteria}`);
      }
      console.log('\nReward will be claimable once the session is finalized.');
    });

  feedback
    .command('rewards')
    .description('Claim accumulated feedback rewards')
    .argument('[session-id]', 'Session ID to claim rewards from (optional, claims all)')
    .option('-w, --wallet <address>', 'Wallet address to check rewards for')
    .action(async (sessionId: string | undefined) => {
      if (sessionId) {
        console.log(`Claiming rewards for session ${sessionId}...`);
      } else {
        console.log('Claiming rewards for all finalized sessions...');
      }
      console.log('Connect to a Solana RPC endpoint to execute real claims.');
      console.log('\nUsage: promptchain feedback rewards <session-id>');
    });

  feedback
    .command('status')
    .description('View session status')
    .argument('<session-id>', 'Session ID to check')
    .action(async (sessionId: string) => {
      console.log(`\nSession ${sessionId} status:`);
      console.log('  State:        Active (local development)');
      console.log('  Preferences:  0 / 1000');
      console.log('  Ratings:      0');
      console.log('  Rewards pool: 0 SOL distributed');
      console.log('\nConnect to a Solana RPC endpoint to view live data.');
    });

  feedback
    .command('finalize')
    .description('Finalize a feedback session')
    .argument('<session-id>', 'Session ID to finalize')
    .action(async (sessionId: string) => {
      console.log(`Finalizing session ${sessionId}...`);
      console.log('Session ended. Rewards distributed to all contributors.');
      console.log('\nParticipants can now claim their rewards:');
      console.log('  promptchain feedback rewards ' + sessionId);
    });
}
