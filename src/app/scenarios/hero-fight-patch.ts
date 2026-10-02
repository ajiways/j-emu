import type { CombatantFightStats } from "../../modules/combat/domain/combatant-fight-stats.ts";

/** What a scenario sets for the hero in this fight instead of what he has; a `null` field keeps his own. */
export type HeroFightPatch = Readonly<{
  strength: number | null;
  initiative: number | null;
  rage: number | null;
  dexterity: number | null;
  defense: number | null;
  block: number | null;
  /** Mana at the start and its maximum, both set to this. */
  mp: number | null;
}>;

export function patchedFightStats(
  stats: CombatantFightStats,
  patch: HeroFightPatch | null,
): CombatantFightStats {
  if (patch === null) return stats;
  return {
    ...stats,
    strength: patch.strength ?? stats.strength,
    initiative: patch.initiative ?? stats.initiative,
    rage: patch.rage ?? stats.rage,
    dexterity: patch.dexterity ?? stats.dexterity,
    defense: patch.defense ?? stats.defense,
    block: patch.block ?? stats.block,
  };
}
