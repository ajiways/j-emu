import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryItem } from "../../inventory/domain/inventory-item.ts";
import {
  collectWornSets,
  isMaleHeroGender,
  pickSetPortrait,
  type SetPortrait,
  type WornSetPiece,
} from "../../inventory/domain/gear-sets.ts";

export async function wornSetPortrait(
  items: readonly InventoryItem[],
  catalog: Catalog,
  gender: number,
): Promise<SetPortrait | null> {
  const pieces: WornSetPiece[] = [];
  for (const item of items) {
    if (item.location.kind !== "equipment") continue;
    const definition = await catalog.artifact(item.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    pieces.push({
      slot: item.location.slot,
      slotMask: definition.slotMask,
      kindId: definition.kindId,
      set: definition.extra.set,
    });
  }
  return pickSetPortrait(collectWornSets(pieces), isMaleHeroGender(gender));
}
