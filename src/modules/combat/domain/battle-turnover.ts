import { replaceFallen, shuffleAfterHits } from "./duel-shuffle.ts";
import { requireBattleHuman } from "./battle-lookups.ts";
import type { FightDuel } from "./fight-duel.ts";
import type { FightRules } from "./fight-rules.ts";
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

/** The waiting ally who takes the place of the fallen or departed `accountId` across from his foe. */
export function replaceFallenOfBattle(state: TurnoverState, accountId: number) {
  return replaceFallen({
    dead: requireBattleHuman(state.roster.humans, accountId),
    humans: state.roster.humans,
    bots: state.roster.bots,
    duels: state.duels,
    openingRandom: state.openingRandom,
  });
}
