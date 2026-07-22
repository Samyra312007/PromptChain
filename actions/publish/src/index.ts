import * as core from '@actions/core';
import * as fs from 'fs';
import * as crypto from 'crypto';
import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  TransactionInstruction,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const PROMPTCHAIN_PROGRAM_ID = new PublicKey(
  'D7zeVCj96CQx1xBEm7EEzVLXw4sNukdykxN7ErmxjF3F'
);

function hashCid(cid: string): Buffer {
  return crypto.createHash('sha256').update(cid).digest();
}

function findPromptAddress(cid: string): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from('prompt'), hashCid(cid)],
    PROMPTCHAIN_PROGRAM_ID
  );
}

async function run(): Promise<void> {
  try {
    const rpcUrl = core.getInput('rpc_url');
    const keypairBase64 = core.getInput('keypair');
    const promptFilePath = core.getInput('prompt_file');
    const metadataFilePath = core.getInput('metadata_file');
    const licenseInput = core.getInput('license');
    const networkCheck = core.getInput('network_check') === 'true';

    const secretKey = Buffer.from(keypairBase64, 'base64');
    const authority = Keypair.fromSecretKey(secretKey);

    const connection = new Connection(rpcUrl, 'confirmed');

    if (networkCheck) {
      core.info(`Network: ${rpcUrl}`);
      core.info(`Authority: ${authority.publicKey.toBase58()}`);
      const balance = await connection.getBalance(authority.publicKey);
      core.info(`Balance: ${balance / LAMPORTS_PER_SOL} SOL`);
      if (balance === 0) {
        core.warning('Wallet has 0 SOL. Ensure it is funded.');
      }
    }

    const promptText = fs.readFileSync(promptFilePath, 'utf-8');
    const metadata = JSON.parse(fs.readFileSync(metadataFilePath, 'utf-8'));

    const cid = crypto
      .createHash('sha256')
      .update(promptText + JSON.stringify(metadata))
      .digest('hex');

    const [promptPda] = findPromptAddress(cid);

    core.info(`Publishing prompt: ${cid}`);
    core.info(`Prompt PDA: ${promptPda.toBase58()}`);

    const publishIx = new TransactionInstruction({
      programId: PROMPTCHAIN_PROGRAM_ID,
      keys: [
        { pubkey: promptPda, isSigner: false, isWritable: true },
        { pubkey: authority.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      data: Buffer.from([
        0xbf, 0x4d, 0x55, 0xb2, 0x9c, 0x05, 0x7b, 0xf6,
        ...Buffer.from(cid).buffer,
      ]),
    });

    const tx = new Transaction().add(publishIx);
    const sig = await connection.sendTransaction(tx, [authority]);
    await connection.confirmTransaction(sig, 'confirmed');

    core.setOutput('signature', sig);
    core.setOutput('prompt_pda', promptPda.toBase58());
    core.setOutput('cid', cid);
    core.info(`Published successfully! Signature: ${sig}`);
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    } else {
      core.setFailed(String(error));
    }
  }
}

run();
