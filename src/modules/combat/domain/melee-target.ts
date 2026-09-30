import type { FightDuel } from "./fight-duel.ts";
import type { Participant } from "./participant.ts";

/** Whoever stands across from `attackerId` in his duel. */
export function duelFoe(
  duel: FightDuel,
  participants: readonly Participant[],
  attackerId: number,
): Participant {
  const foeId = duel.otherId(attackerId);
  const foe = participants.find((entry) => entry.id === foeId);
  if (!foe) throw new Error(`Duel opponent ${foeId} is not in the fight`);
  return foe;
}

/** No one of `team` is left standing. */
export function enemySideCleared(team: 1 | 2, participants: readonly Participant[]): boolean {
  return !participants.some((entry) => entry.team === team && entry.alive);
}
