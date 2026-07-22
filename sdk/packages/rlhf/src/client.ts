import { Program, Provider, web3 } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { RLHF_PROGRAM_ID } from '@promptchain/schema';
import { RlhfPDA } from './pda';
import { PreferenceSubmission, RatingSubmission, SessionStatus } from './types';

export class RlhfClient {
  private program: Program;
  private provider: Provider;

  constructor(provider: Provider) {
    this.provider = provider;
    this.program = new Program(
      {} as any,
      new PublicKey(RLHF_PROGRAM_ID),
      provider
    );
  }

  async initSession(
    sessionId: number,
    promptCid: string,
    modelName: string,
    maxPreferences: number,
    rewardPerPreference: number
  ): Promise<string> {
    const [sessionPda] = RlhfPDA.findSessionPda(sessionId);
    const tx = await this.program.methods
      .initSession(
        sessionId,
        promptCid,
        modelName,
        maxPreferences,
        rewardPerPreference
      )
      .accounts({
        session: sessionPda,
        authority: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return tx;
  }

  async submitPreference(
    sessionId: number,
    preferenceId: number,
    submission: PreferenceSubmission
  ): Promise<string> {
    const [sessionPda] = RlhfPDA.findSessionPda(sessionId);
    const [preferencePda] = RlhfPDA.findPreferencePda(sessionId, preferenceId);
    const [rewardPda] = RlhfPDA.findRewardPda(
      this.provider.wallet.publicKey,
      sessionPda
    );
    const tx = await this.program.methods
      .submitPreference(
        preferenceId,
        submission.preferredOutputUri,
        submission.rejectedOutputUri,
        submission.criteria
      )
      .accounts({
        session: sessionPda,
        preference: preferencePda,
        reward: rewardPda,
        rater: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return tx;
  }

  async submitRating(
    sessionId: number,
    ratingId: number,
    submission: RatingSubmission
  ): Promise<string> {
    const [sessionPda] = RlhfPDA.findSessionPda(sessionId);
    const [ratingPda] = RlhfPDA.findRatingPda(sessionId, ratingId);
    const tx = await this.program.methods
      .submitRating(ratingId, submission.outputUri, submission.ratingValue, submission.criteria)
      .accounts({
        session: sessionPda,
        rating: ratingPda,
        rater: this.provider.wallet.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return tx;
  }

  async claimReward(rater: PublicKey, sessionId: number): Promise<string> {
    const [sessionPda] = RlhfPDA.findSessionPda(sessionId);
    const [rewardPda] = RlhfPDA.findRewardPda(rater, sessionPda);
    const tx = await this.program.methods
      .claimReward()
      .accounts({
        reward: rewardPda,
        session: sessionPda,
        rater,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
    return tx;
  }

  async finalizeSession(sessionId: number): Promise<string> {
    const [sessionPda] = RlhfPDA.findSessionPda(sessionId);
    const tx = await this.program.methods
      .finalizeSession()
      .accounts({
        session: sessionPda,
        authority: this.provider.wallet.publicKey,
      })
      .rpc();
    return tx;
  }

  async getSession(sessionId: number): Promise<any> {
    const [sessionPda] = RlhfPDA.findSessionPda(sessionId);
    return this.program.account.rlhfSession.fetch(sessionPda);
  }

  getStatus(session: any): SessionStatus {
    if (!session.isActive) return SessionStatus.Ended;
    if (session.totalPreferences >= session.maxPreferences) return SessionStatus.Full;
    return SessionStatus.Active;
  }
}
