import type { CombatSpell } from "./combat-loadout.ts";

/** Turns a stun spell costs its target. Only turn-counted stuns exist in the data we model. */
export function stunTurns(spell: CombatSpell, artikulId: number): number {
  const stun = spell.effects.find((effect) => effect.kind === 18);
  if (!stun || stun.duration === undefined) {
    throw new Error(`Stun spell ${artikulId} duration is required`);
  }
  if (stun.durationInTurns !== true) {
    throw new Error(`Stun spell ${artikulId} is timed, only durationInTurns stuns are supported`);
  }
  if (!Number.isInteger(stun.duration) || stun.duration < 1) {
    throw new Error(`Stun spell ${artikulId} duration must be a positive integer`);
  }
  return stun.duration;
}
