import type {
  FightHumanOutcome,
  FightOutcomeSnapshot,
} from "../modules/combat/domain/fight-outcome-snapshot.ts";
import type { FightCounterDelta } from "../modules/character/ports/hero-lifetime-stats.ts";

/**
 * What a finished fight adds to the lifetime counters of each human who stayed to its end: a
 * win or a loss (a friendly duel counts only the won duels), the most damage of one fight, his
 * executions and the players he finished off. Whoever walked out early is paid nothing.
 */
export function fightCounterDeltas(
  outcome: FightOutcomeSnapshot,
  dailyCycleStart: number,
): readonly FightCounterDelta[] {
  const practice = outcome.mode === "friendly-practice";
  return outcome.humans
    .filter((human: FightHumanOutcome) => !human.leftLive)
    .map((human) => {
      const won = human.team === outcome.winnerTeam;
      return {
        characterId: human.characterId,
        wins: !practice && won ? 1 : 0,
        losses: !practice && !won ? 1 : 0,
        duelWins: practice && won ? 1 : 0,
        fightDamage: human.damageToBot + human.damageToHumans,
        fatalities: human.executedVictimIds.length,
        pvpKills: human.humanKills,
        dailyCycleStart,
      };
    });
}
