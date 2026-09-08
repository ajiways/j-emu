import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";

export type ArtifactSkillWireBlock = Readonly<{
  title: string;
  skill_id: string;
  value: number;
  skill_flags: number;
  context_id: readonly Readonly<{ context: "0"; value: string; value2: string }>[];
}>;

export async function artifactSkillWireMap(
  skills: readonly ArtifactSkillBonus[],
  catalog: Catalog,
): Promise<Readonly<Record<string, ArtifactSkillWireBlock>>> {
  const blocks: Record<string, ArtifactSkillWireBlock> = {};
  for (const bonus of skills) {
    const skill = await catalog.skill(bonus.id);
    const value = String(bonus.value);
    blocks[bonus.id] = {
      title: skill.title,
      skill_id: bonus.id,
      value: bonus.value,
      skill_flags: bonus.flags,
      context_id: [{ context: "0", value, value2: value }],
    };
  }
  return blocks;
}
