import type { FightDuel } from "./fight-duel.ts";
import type { HumanFighter } from "./human-fighter.ts";
import type { Participant } from "./participant.ts";
import type { RandomSource } from "./random-source.ts";
import { rollDuelOpener } from "./roll-duel-opener.ts";

/** A waiting human takes a side of the duel; who strikes first is rolled against the other side. */
export function retargetDuelTo(
  input: Readonly<{
    duel: FightDuel;
    fromHeroId: number;
    waiter: HumanFighter;
    /** The side that stays in the duel. */
    other: Participant;
    openingRandom: RandomSource;
  }>,
): void {
  input.waiter.pair();
  input.duel.replace(input.fromHeroId, input.waiter.heroId);
  input.duel.resetHits();
  rollDuelOpener(input.duel, {
    holder: input.waiter,
    other: input.other,
    random: input.openingRandom,
  });
}
