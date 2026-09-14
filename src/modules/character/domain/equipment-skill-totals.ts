import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";
import type { HeroSkill } from "./hero-skill.ts";

const SKILL_FLAG_PERCENT = 1;
const PERCENT_MULTIPLIER_SKILLS = new Set(["STR", "RAG", "DEX", "DEF", "VIT", "MPMAX", "HPREG"]);

export function totalHeroSkills(
  naked: readonly HeroSkill[],
  bonuses: readonly ArtifactSkillBonus[],
): readonly HeroSkill[] {
  if (naked.length < 1) throw new Error("Naked hero skills are required");
  const flat = new Map<string, number>();
  const percent = new Map<string, number>();
  for (const bonus of bonuses) {
    if ((bonus.flags & SKILL_FLAG_PERCENT) !== 0 && PERCENT_MULTIPLIER_SKILLS.has(bonus.id)) {
      percent.set(bonus.id, (percent.get(bonus.id) ?? 0) + bonus.value);
      continue;
    }
    flat.set(bonus.id, (flat.get(bonus.id) ?? 0) + bonus.value);
  }
  const ids = new Set<string>([
    ...naked.map((skill) => skill.id),
    ...flat.keys(),
    ...percent.keys(),
  ]);
  const totals: HeroSkill[] = [];
  for (const id of ids) {
    const base = naked.find((skill) => skill.id === id)?.value ?? 0;
    const added = Math.round((base + (flat.get(id) ?? 0)) * (1 + (percent.get(id) ?? 0) / 100));
    totals.push({ id, value: added });
  }
  return totals;
}

export function requiredSkillTotal(skills: readonly HeroSkill[], id: string): number {
  const skill = skills.find((entry) => entry.id === id);
  if (!skill) throw new Error(`Hero skill ${id} is missing`);
  if (skill.value < 1) throw new Error(`Hero skill ${id} total must be positive`);
  return skill.value;
}

export function skillTotalNonNegative(skills: readonly HeroSkill[], id: string): number {
  const skill = skills.find((entry) => entry.id === id);
  if (!skill) throw new Error(`Hero skill ${id} is missing`);
  if (!Number.isInteger(skill.value) || skill.value < 0) {
    throw new Error(`Hero skill ${id} total must be a non-negative integer`);
  }
  return skill.value;
}
