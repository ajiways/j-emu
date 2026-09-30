import type { CombatPocketRow } from "./combat-loadout.ts";
import { spellCharging } from "./cast-state.ts";

export function requirePocketOrb(row: CombatPocketRow): void {
  if (spellCharging(row.spell) < 1) {
    throw new Error(`Pocket artifact ${row.artifactId} kind-3 charging is required`);
  }
}
