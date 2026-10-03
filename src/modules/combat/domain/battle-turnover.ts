import type { BattleEvent } from "./battle-event.ts";
import { pairNextWaiter } from "./battle-pairing.ts";
import { shuffleAfterHits } from "./duel-shuffle.ts";
import { duelPairingOf, requireBattleHuman } from "./battle-lookups.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FightRules } from "./fight-rules.ts";
import { primaryEnemyBot } from "./fight-bots.ts";
import type { RandomSource } from "./random-source.ts";
import type { Roster } from "./roster.ts";
import type { ShuffleOutcome } from "./try-shuffle-after-hits.ts";

type TurnoverState = Readonly<{
  fightRules: FightRules;
  finished: boolean;
  roster: Roster;
  duels: FightDuel[];
  openingRandom: RandomSource;
}>;

export type NextWaiter = Readonly<{
  accountId: number;
  authed: boolean;
  events: readonly BattleEvent[];
}>;

/** The shuffle of the duel `accountId` stands in, once its hits ran out. */
export function shuffleOfBattle(state: TurnoverState, accountId: number): ShuffleOutcome {
  if (!state.fightRules.rotatesDuels) return { kind: "none" };
  const human = requireBattleHuman(state.roster.humans, accountId);
  return shuffleAfterHits({
    actor: human,
    humans: state.roster.humans,
    bots: state.roster.bots,
    duels: state.duels,
    finished: state.finished,
    openingRandom: state.openingRandom,
  });
}

/** The waiting player who takes the place of `previousAccountId` across from the mob. */
export function nextWaiterOfBattle(
  state: TurnoverState,
  previousAccountId: number,
): NextWaiter | null {
  if (!state.fightRules.pairsNextWaiter) return null;
  const previous = requireBattleHuman(state.roster.humans, previousAccountId);
  const duel = state.duels.find((entry) => entry.has(previous.heroId));
  if (!duel) return null;
  const { enemyTeam, openerTeam } = state.fightRules.teamAssignment;
  const primary = primaryEnemyBot(state.roster.bots, enemyTeam);
  return pairNextWaiter({
    pairing: duelPairingOf(duel, state.roster.humans, previousAccountId),
    primary,
    openerTeam,
    enemyTeam,
    botHp: primary.hp,
    finished: state.finished,
    openingRandom: state.openingRandom,
  });
}
