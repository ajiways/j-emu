import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { ArtifactSkillBonus } from "../../catalog/domain/artifact-skill-bonus.ts";
import type { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import { FLAG_PUT_OFF } from "./item-action-flags.ts";

type EquippedArtifactSkillBlock = Readonly<{
  skill_id: string;
  value: number;
  skill_flags: number;
}>;

export type EquippedArtifactBlock = Readonly<{
  id: number;
  artikul_id: number;
  title: string;
  picture: string;
  type_id: string;
  kind_id: number;
  slot: number;
  slot2: 0;
  slot_num: 0;
  slot_mask: number;
  cnt: 0;
  actions: typeof FLAG_PUT_OFF;
  artifact_skills: Readonly<Record<string, EquippedArtifactSkillBlock>>;
}>;

export function buildEquippedArtifact(
  item: InventoryItem,
  definition: ArtifactDefinition,
): EquippedArtifactBlock {
  if (item.location.kind !== "equipment") {
    throw new Error(`Item ${item.id} is not equipped`);
  }
  if (item.artifactId !== definition.id) {
    throw new Error(
      `Item ${item.id} catalog id ${item.artifactId} does not match ${definition.id}`,
    );
  }
  return {
    id: item.id,
    artikul_id: definition.id,
    title: definition.title,
    picture: definition.picture,
    type_id: definition.typeId,
    kind_id: definition.kindId,
    slot: item.location.slot,
    slot2: 0,
    slot_num: 0,
    slot_mask: definition.slotMask,
    cnt: 0,
    actions: FLAG_PUT_OFF,
    artifact_skills: skillBlocks(definition.skills),
  };
}

function skillBlocks(
  skills: readonly ArtifactSkillBonus[],
): Readonly<Record<string, EquippedArtifactSkillBlock>> {
  const blocks: Record<string, EquippedArtifactSkillBlock> = {};
  for (const skill of skills) {
    blocks[skill.id] = {
      skill_id: skill.id,
      value: skill.value,
      skill_flags: skill.flags,
    };
  }
  return blocks;
}
