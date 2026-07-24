import { PublicKey } from "@solana/web3.js";
import { AnchorProvider } from "@coral-xyz/anchor";
import { CurationClient, findReputationPda } from "@promptchain/curation";
import { ReputationCalculator } from "./reputation-calculator";
import { VerifiableCredentialManager } from "./verifiable-credential";
import { SoulboundRegistry } from "./soulbound-registry";
import { DelegatedIdentityManager } from "./delegated-identity";
import {
  ReputationScore,
  ReputationFactors,
  IdentityProfile,
  W3CVerifiableCredential,
  SoulboundAttestation,
} from "./types";

export class IdentityClient {
  private curationClient: CurationClient;
  private reputationCalculator: ReputationCalculator;
  private credentialManager: VerifiableCredentialManager;
  private soulboundRegistry: SoulboundRegistry;
  private delegatedIdentity: DelegatedIdentityManager;

  constructor(provider: AnchorProvider) {
    this.curationClient = new CurationClient(provider);
    this.reputationCalculator = new ReputationCalculator();
    this.credentialManager = new VerifiableCredentialManager();
    this.soulboundRegistry = new SoulboundRegistry();
    this.delegatedIdentity = new DelegatedIdentityManager();
  }

  get reputationCalculatorInstance(): ReputationCalculator {
    return this.reputationCalculator;
  }

  get credentialManagerInstance(): VerifiableCredentialManager {
    return this.credentialManager;
  }

  get soulboundRegistryInstance(): SoulboundRegistry {
    return this.soulboundRegistry;
  }

  get delegatedIdentityInstance(): DelegatedIdentityManager {
    return this.delegatedIdentity;
  }

  async fetchReputationScore(authority: PublicKey): Promise<ReputationScore | null> {
    try {
      const [reputationPda] = findReputationPda(authority);
      const onChain = await this.curationClient.fetchReputation(reputationPda);
      const factors: ReputationFactors = {
        curationAccuracyBp: onChain.curationAccuracyBp.toNumber(),
        contentQualityBp: onChain.overallScoreBp.toNumber(),
        communityContributionsBp: Math.min(10000, onChain.promptsPublished.toNumber() * 100 + onChain.curationsPerformed.toNumber() * 50),
        slashingEventsBp: 0,
      };
      return this.reputationCalculator.compute(factors);
    } catch {
      return null;
    }
  }

  async buildProfile(authority: PublicKey): Promise<IdentityProfile> {
    const reputation = await this.fetchReputationScore(authority);
    const walletStr = authority.toBase58();
    const attestations = this.soulboundRegistry.getAttestationsBySubject(walletStr);
    const delegations = this.delegatedIdentity.getDelegationsByWallet(walletStr);

    return {
      walletAddress: walletStr,
      reputation,
      credentials: [],
      soulboundAttestations: attestations,
      delegations,
      promptsPublished: reputation?.communityContributionsBp
        ? Math.floor(reputation.communityContributionsBp / 100)
        : 0,
      curationsPerformed: reputation?.curationAccuracyBp
        ? Math.floor(reputation.curationAccuracyBp / 100)
        : 0,
      joinedAt: Date.now(),
    };
  }
}
