import { describe, it, expect } from 'vitest';
import { RlhfPDA } from '../pda';
import { PublicKey, Keypair } from '@solana/web3.js';

function uniquePubkey(): PublicKey {
  return Keypair.generate().publicKey;
}

describe('RlhfPDA', () => {
  it('should find deterministic session PDA for same id', () => {
    const [pda1] = RlhfPDA.findSessionPda(1);
    const [pda2] = RlhfPDA.findSessionPda(1);
    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });

  it('should find different session PDA for different ids', () => {
    const [pda1] = RlhfPDA.findSessionPda(1);
    const [pda2] = RlhfPDA.findSessionPda(2);
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });

  it('should find deterministic preference PDA', () => {
    const [pda1] = RlhfPDA.findPreferencePda(1, 1);
    const [pda2] = RlhfPDA.findPreferencePda(1, 1);
    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });

  it('should find deterministic rating PDA', () => {
    const [pda1] = RlhfPDA.findRatingPda(1, 1);
    const [pda2] = RlhfPDA.findRatingPda(1, 1);
    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });

  it('should find deterministic reward PDA', () => {
    const rater = uniquePubkey();
    const session = uniquePubkey();
    const [pda1] = RlhfPDA.findRewardPda(rater, session);
    const [pda2] = RlhfPDA.findRewardPda(rater, session);
    expect(pda1.toBase58()).toBe(pda2.toBase58());
  });

  it('should find different reward PDA for different raters', () => {
    const rater1 = uniquePubkey();
    const rater2 = uniquePubkey();
    const session = uniquePubkey();
    const [pda1] = RlhfPDA.findRewardPda(rater1, session);
    const [pda2] = RlhfPDA.findRewardPda(rater2, session);
    expect(pda1.toBase58()).not.toBe(pda2.toBase58());
  });
});
