import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";

export type ArtifactSkillWireBlock = Readonly<{
  title: string;
  skill_id: string;
  value: number;
  skill_flags: number;
  context_id: readonly Readonly<{ context: "0"; value: string; value2: string }>[];
  upgrade_id?: number;
  upgrade_value?: number;
}>;

export async function artifactSkillWireMap(
  skills: readonly ArtifactSkillBonus[],
  catalog: Catalog,
  upgradeBySkill: ReadonlyMap<
    string,
    Readonly<{ upgradeId: number; upgradeValue: number }>
  > = new Map(),
): Promise<Readonly<Record<string, ArtifactSkillWireBlock>>> {
  const blocks: Record<string, ArtifactSkillWireBlock> = {};
  for (const bonus of skills) {
    const skill = await catalog.skill(bonus.id);
    const value = String(bonus.value);
    const overlay = upgradeBySkill.get(bonus.id);
    blocks[bonus.id] = {
      title: skill.title,
      skill_id: bonus.id,
      value: bonus.value,
      skill_flags: bonus.flags,
      context_id: [{ context: "0", value, value2: value }],
      ...(overlay ? { upgrade_id: overlay.upgradeId, upgrade_value: overlay.upgradeValue } : {}),
    };
  }
  return blocks;
}
