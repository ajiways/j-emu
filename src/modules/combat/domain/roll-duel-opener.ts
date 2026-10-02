import type { FightDuel } from "./fight-duel.ts";
import type { Participant } from "./participant.ts";
import type { RandomSource } from "./random-source.ts";
import { rollOpensFirst } from "./roll-opens-first.ts";

/**
 * A duel that got a new side rolls who strikes first, as a new pair does: the odds follow the
 * initiative of both. `holder` is who would take the turn without a roll (the one who stepped in,
 * or the one who just acted), so a roll that does not favour `other` leaves the turn with him.
 */
export function rollDuelOpener(
  duel: FightDuel,
  input: Readonly<{ holder: Participant; other: Participant; random: RandomSource }>,
): void {
  const { holder, other } = input;
  const otherFirst = rollOpensFirst(
    other.currentInitiative,
    holder.currentInitiative,
    input.random,
  );
  duel.setNextActor(otherFirst ? other.id : holder.id);
}
