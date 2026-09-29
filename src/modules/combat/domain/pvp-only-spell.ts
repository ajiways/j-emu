import type { CombatSpell } from "./combat-loadout.ts";
import { FightCastDenied } from "./fight-cast-denied.ts";

/** Spells the catalog marks `onlyPvP` cannot be cast in a fight without a human on each side. */
export function requirePvpForSpell(
  spell: CombatSpell,
  pvp: boolean,
  sequence: string | number,
): void {
  if (spell.onlyPvP === true && !pvp) throw new FightCastDenied("pvp-only", sequence);
}
