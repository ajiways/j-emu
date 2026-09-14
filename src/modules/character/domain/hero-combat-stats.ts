import { huntAggroCharges } from "./hunt-aggro-charges.ts";
import { requiredSkillTotal, skillTotalNonNegative } from "./equipment-skill-totals.ts";
import type { HeroSkill } from "./hero-skill.ts";

export type HeroCombatStats = Readonly<{
  strength: number;
  initiative: number;
  rage: number;
  dexterity: number;
  defense: number;
  block: number;
  aggroCharges: number;
  mag: Readonly<{ power: number; resist: number }>;
}>;

export function heroCombatStatsFromTotals(totals: readonly HeroSkill[]): HeroCombatStats {
  return {
    strength: requiredSkillTotal(totals, "STR"),
    initiative: skillTotalNonNegative(totals, "LUCK"),
    rage: requiredSkillTotal(totals, "RAG"),
    dexterity: requiredSkillTotal(totals, "DEX"),
    defense: requiredSkillTotal(totals, "DEF"),
    block: skillTotalNonNegative(totals, "BLOK"),
    aggroCharges: huntAggroCharges(skillTotalNonNegative(totals, "AGRILKA_MOBOV")),
    mag: { power: 0, resist: 0 },
  };
}
