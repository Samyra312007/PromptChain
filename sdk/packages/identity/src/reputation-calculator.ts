import {
  ReputationFactors,
  ReputationScore,
  ReputationHistoryEntry,
  SlashingEvent,
  REPUTATION_ALPHA_BP,
  REPUTATION_BETA_BP,
  REPUTATION_GAMMA_BP,
  REPUTATION_DELTA_BP,
  BPS_DENOMINATOR,
  MAX_REPUTATION,
  IDENTITY_VERSION,
  REPUTATION_HALF_LIFE_DAYS,
} from "./types";

export class ReputationCalculator {
  compute(factors: ReputationFactors): ReputationScore {
    const clampedCuration = this.clampBp(factors.curationAccuracyBp);
    const clampedContent = this.clampBp(factors.contentQualityBp);
    const clampedCommunity = this.clampBp(factors.communityContributionsBp);
    const clampedSlashing = this.clampBp(factors.slashingEventsBp);

    const positiveSum =
      clampedCuration * REPUTATION_ALPHA_BP +
      clampedContent * REPUTATION_BETA_BP +
      clampedCommunity * REPUTATION_GAMMA_BP;

    const overallBeforeSlashing = Math.floor(positiveSum / BPS_DENOMINATOR);
    const slashingPenalty = Math.floor((overallBeforeSlashing * clampedSlashing * REPUTATION_DELTA_BP) / BPS_DENOMINATOR / BPS_DENOMINATOR);
    const overallBp = Math.max(0, Math.min(MAX_REPUTATION, overallBeforeSlashing - slashingPenalty));

    return {
      overallBp,
      curationAccuracyBp: clampedCuration,
      contentQualityBp: clampedContent,
      communityContributionsBp: clampedCommunity,
      slashingEventsBp: clampedSlashing,
      computedAt: Date.now(),
      version: IDENTITY_VERSION,
    };
  }

  computeWithHistory(
    factors: ReputationFactors,
    priorHistory: ReputationHistoryEntry[],
    slashingEvents: SlashingEvent[],
  ): ReputationScore {
    const decayedCuration = this.applyDecay(factors.curationAccuracyBp, priorHistory, "curation");
    const decayedContent = this.applyDecay(factors.contentQualityBp, priorHistory, "content");
    const decayedCommunity = this.applyDecay(factors.communityContributionsBp, priorHistory, "community");
    const totalSlashing = this.aggregateSlashing(slashingEvents);

    return this.compute({
      curationAccuracyBp: decayedCuration,
      contentQualityBp: decayedContent,
      communityContributionsBp: decayedCommunity,
      slashingEventsBp: totalSlashing,
    });
  }

  aggregateSlashing(events: SlashingEvent[]): number {
    if (events.length === 0) return 0;
    const totalBp = events.reduce((sum, e) => sum + e.amountBp, 0);
    return Math.min(BPS_DENOMINATOR, totalBp);
  }

  clampBp(value: number): number {
    return Math.max(0, Math.min(BPS_DENOMINATOR, Math.round(value)));
  }

  decayScore(currentBp: number, daysSinceLastUpdate: number): number {
    if (daysSinceLastUpdate <= 0) return currentBp;
    const halvings = daysSinceLastUpdate / REPUTATION_HALF_LIFE_DAYS;
    const decayFactor = Math.pow(0.5, halvings);
    return Math.round(currentBp * decayFactor);
  }

  private applyDecay(
    current: number,
    history: ReputationHistoryEntry[],
    _field: string,
  ): number {
    if (history.length === 0) return current;
    const lastEntry = history[history.length - 1];
    const daysSince = (Date.now() - lastEntry.recordedAt) / (1000 * 60 * 60 * 24);
    return this.decayScore(current, daysSince);
  }

  compare(scores: ReputationScore[]): ReputationScore {
    if (scores.length === 0) {
      return this.compute({
        curationAccuracyBp: 0,
        contentQualityBp: 0,
        communityContributionsBp: 0,
        slashingEventsBp: 0,
      });
    }
    const avg = (field: keyof ReputationFactors) =>
      Math.round(scores.reduce((s, r) => s + r[field], 0) / scores.length);
    return this.compute({
      curationAccuracyBp: avg("curationAccuracyBp"),
      contentQualityBp: avg("contentQualityBp"),
      communityContributionsBp: avg("communityContributionsBp"),
      slashingEventsBp: avg("slashingEventsBp"),
    });
  }
}
