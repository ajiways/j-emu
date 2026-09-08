import type { SkillDefinition } from "../../catalog/domain/skill-definition.ts";
import type { HeroSkill } from "../../character/domain/hero-skill.ts";

type UserSkillRow = Readonly<{
  id: string;
  title: string;
  value: number | string;
  group: string;
  order: string;
  weight: string;
  image: string;
}>;

export type UserSkillsBlock = Readonly<{
  status: 100;
  amount_max: number;
  skills: readonly UserSkillRow[];
}>;

export type UserSkillsExpireBlock = Readonly<{
  expire: 0;
}>;

export function buildUserSkills(
  skills: readonly HeroSkill[],
  definitions: ReadonlyMap<string, SkillDefinition>,
  bagCapacity: number,
): UserSkillsBlock {
  if (bagCapacity < 1) throw new Error("Skills amount_max must be positive");
  const rows: UserSkillRow[] = [];
  for (const skill of skills) {
    if (omittedZeroDropSkill(skill)) continue;
    const definition = definitions.get(skill.id);
    if (!definition) throw new Error(`Skill catalog entry ${skill.id} is missing`);
    rows.push({
      id: definition.id,
      title: definition.title,
      value: definition.valueKind === "string" ? String(skill.value) : skill.value,
      group: definition.group,
      order: definition.order,
      weight: definition.weight,
      image: definition.image,
    });
  }
  if (rows.length < 1) throw new Error("Visible hero skills are required");
  return { status: 100, amount_max: bagCapacity, skills: rows };
}

export function skillsExpireBlock(): UserSkillsExpireBlock {
  return { expire: 0 };
}

function omittedZeroDropSkill(skill: HeroSkill): boolean {
  return (skill.id === "MONEYMOD" || skill.id === "AGRILKA_MOBOV") && skill.value === 0;
}
