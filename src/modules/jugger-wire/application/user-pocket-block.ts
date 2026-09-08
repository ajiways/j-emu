import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import type { InventoryService } from "../../inventory/domain/inventory-service.ts";
import { SLOT_EFFECT } from "../../inventory/domain/pocket-slot.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import { FLAG_PUT_OFF } from "./item-action-flags.ts";
import { moneyNumberFromMinorUnits } from "./money-from-minor-units.ts";

type PocketItemBlock = Readonly<{
  id: number;
  artikul_id: number;
  title: string;
  picture: string;
  type_id: string;
  kind_id: number;
  slot: typeof SLOT_EFFECT;
  slot2: 0;
  slot_num: number;
  slot_mask: number;
  level_min: number;
  level_max: number;
  cnt: number;
  actions: typeof FLAG_PUT_OFF;
  flags: number;
  price: number;
  artifact_skills: readonly [];
}>;

export type UserPocketBlock = Readonly<{
  status: 100;
  capacity: number;
  pocket: readonly PocketItemBlock[];
}>;

export async function buildUserPocket(
  inventory: InventoryService,
  catalog: Catalog,
  characterId: number,
  pocketCapacity: number,
): Promise<UserPocketBlock> {
  if (!Number.isInteger(pocketCapacity) || pocketCapacity < 1) {
    throw new Error("Pocket capacity must be a positive integer");
  }
  const pocket: PocketItemBlock[] = [];
  for (const item of await inventory.listPocket({ characterId })) {
    const definition = await catalog.artifact(item.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    pocket.push(pocketItemBlock(item, definition));
  }
  return { status: 100, capacity: pocketCapacity, pocket };
}

function pocketItemBlock(item: InventoryItem, definition: ArtifactDefinition): PocketItemBlock {
  if (item.location.kind !== "pocket") {
    throw new Error(`Item ${item.id} is not in the pocket`);
  }
  if (item.artifactId !== definition.id) {
    throw new Error(
      `Item ${item.id} catalog id ${item.artifactId} does not match ${definition.id}`,
    );
  }
  if (definition.skills.length > 0) {
    throw new Error(`Pocket artifact ${definition.id} skills are not published`);
  }
  return {
    id: item.id,
    artikul_id: definition.id,
    title: definition.title,
    picture: definition.picture,
    type_id: definition.typeId,
    kind_id: definition.kindId,
    slot: SLOT_EFFECT,
    slot2: 0,
    slot_num: item.location.position,
    slot_mask: definition.slotMask,
    level_min: definition.levelMin,
    level_max: definition.levelMax,
    cnt: item.quantity,
    actions: FLAG_PUT_OFF,
    flags: definition.flags,
    price: moneyNumberFromMinorUnits(definition.priceMinor),
    artifact_skills: [],
  };
}
