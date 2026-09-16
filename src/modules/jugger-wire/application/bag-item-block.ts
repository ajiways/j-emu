import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import { bagActionsFor } from "../../inventory/domain/bag-actions.ts";
import { instanceDurability, isBroken } from "../../inventory/domain/durability.ts";
import { noweightWire } from "../../inventory/domain/artifact-flags.ts";
import { canItemBeUpgraded } from "../../inventory/domain/gear-upgrade.ts";
import type { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import { sellPriceMinor } from "../../inventory/domain/sell-price.ts";
import { artifactActionsWire, type ArtifactActionWireBlock } from "./artifact-actions-wire.ts";
import { artifactInstanceOverlay } from "./artifact-instance-overlay.ts";
import { artifactSkillWireMap, type ArtifactSkillWireBlock } from "./artifact-skill-wire.ts";
import { gloveInstanceFromCatalog, type GloveInstanceWire } from "./glove-instance-wire.ts";
import { moneyNumberFromMinorUnits } from "./money-from-minor-units.ts";

export type BagItemBlock = Readonly<{
  id: number;
  artikul_id: number;
  title: string;
  picture: string;
  type_id: string;
  kind_id: number;
  slot: 0;
  slot2: 0;
  slot_num: 0;
  slot_mask: number;
  level_min: number;
  level_max: number;
  cnt: number;
  durability: number;
  durability_max: number;
  action: "bag";
  actions: number;
  flags: number;
  noweight: 0 | 1;
  price: number;
  sell_price: number;
  upgrade_id: number;
  upgrade_level: number;
  upgrade_add: number;
  artifact_skills: Readonly<Record<string, ArtifactSkillWireBlock>>;
  artifact_actions: Readonly<Record<string, ArtifactActionWireBlock>>;
}> &
  Partial<GloveInstanceWire>;

export async function buildBagItemBlock(
  definition: ArtifactDefinition,
  item: InventoryItem,
  catalog: Catalog,
): Promise<BagItemBlock> {
  const overlay = artifactInstanceOverlay(definition, item);
  const glove = await gloveInstanceFromCatalog(definition, catalog);
  return {
    id: item.id,
    artikul_id: definition.id,
    title: definition.title,
    picture: definition.picture,
    type_id: definition.typeId,
    kind_id: definition.kindId,
    slot: 0,
    slot2: 0,
    slot_num: 0,
    slot_mask: definition.slotMask,
    level_min: definition.levelMin,
    level_max: definition.levelMax,
    cnt: item.quantity,
    durability: item.durability,
    durability_max: item.durabilityMax,
    action: "bag",
    actions: bagActionsFor(
      definition.slotMask,
      definition.useAction !== undefined,
      isBroken(instanceDurability(item.durability, item.durabilityMax, definition.flags)),
      canItemBeUpgraded({
        typeId: definition.typeId,
        kindId: definition.kindId,
        skills: definition.skills,
        upgradeId: item.upgrade.id,
        upgradeLevel: item.upgrade.level,
        slotMask: definition.slotMask,
      }),
    ),
    flags: overlay.flags,
    noweight: noweightWire(definition.flags),
    price: moneyNumberFromMinorUnits(definition.priceMinor),
    sell_price: moneyNumberFromMinorUnits(sellPriceMinor(definition.priceMinor)),
    upgrade_id: overlay.upgrade_id,
    upgrade_level: overlay.upgrade_level,
    upgrade_add: overlay.upgrade_add,
    artifact_skills: await artifactSkillWireMap(overlay.skills, catalog, overlay.upgradeBySkill),
    artifact_actions: artifactActionsWire(definition.useActions),
    ...(glove ?? {}),
  };
}
