export type HeroSkill = Readonly<{
  id: string;
  value: number;
}>;

export function requireHeroSkills(skills: readonly HeroSkill[]): readonly HeroSkill[] {
  if (skills.length < 1) throw new Error("Hero skills are required");
  const ids = new Set<string>();
  for (const skill of skills) {
    if (!skill.id) throw new Error("Hero skill id is required");
    if (!Number.isInteger(skill.value) || skill.value < 0) {
      throw new Error(`Hero skill ${skill.id} value is invalid`);
    }
    if (ids.has(skill.id)) throw new Error(`Duplicate hero skill ${skill.id}`);
    ids.add(skill.id);
  }
  return skills;
}
