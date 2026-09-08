import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import type { ArtifactSkillWireBlock } from "./artifact-skill-wire.ts";
import { FLAG_PUT_OFF } from "./item-action-flags.ts";

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
  level_min: number;
  level_max: number;
  cnt: 0;
  actions: typeof FLAG_PUT_OFF;
  artifact_skills: Readonly<Record<string, ArtifactSkillWireBlock>>;
  artifact_actions: Readonly<Record<string, never>>;
}>;

export function buildEquippedArtifact(
  item: InventoryItem,
  definition: ArtifactDefinition,
  artifactSkills: Readonly<Record<string, ArtifactSkillWireBlock>>,
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
    level_min: definition.levelMin,
    level_max: definition.levelMax,
    cnt: 0,
    actions: FLAG_PUT_OFF,
    artifact_skills: artifactSkills,
    artifact_actions: {},
  };
}
