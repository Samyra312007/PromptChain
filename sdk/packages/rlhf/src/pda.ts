import { PublicKey } from '@solana/web3.js';

const RLHF_PROGRAM_ID = 'HWCLoMcpEYxCmR8VqztWF9YF7wYN7pjpKuZQPs5utrmT';

export class RlhfPDA {
  static findSessionPda(sessionId: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('rlhf_session'), Buffer.from(sessionId.toString())],
      new PublicKey(RLHF_PROGRAM_ID)
    );
  }

  static findPreferencePda(sessionId: number, preferenceId: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('rlhf_preference'),
        Buffer.from(sessionId.toString()),
        Buffer.from(preferenceId.toString()),
      ],
      new PublicKey(RLHF_PROGRAM_ID)
    );
  }

  static findRatingPda(sessionId: number, ratingId: number): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [
        Buffer.from('rlhf_rating'),
        Buffer.from(sessionId.toString()),
        Buffer.from(ratingId.toString()),
      ],
      new PublicKey(RLHF_PROGRAM_ID)
    );
  }

  static findRewardPda(rater: PublicKey, session: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('rlhf_reward'), rater.toBuffer(), session.toBuffer()],
      new PublicKey(RLHF_PROGRAM_ID)
    );
  }
}
