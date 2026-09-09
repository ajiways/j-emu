import type { Catalog } from "../../catalog/ports/catalog.ts";
import { ARTIFACT_KIND_SET_BONUS } from "../../catalog/domain/artifact-kind.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import type { InventoryItem } from "./inventory-item.ts";
import {
  collectWornSets,
  KIND_SET,
  wantedSetBonusArtikuls,
  type WornSetPiece,
} from "./gear-sets.ts";

export async function syncGearSetBonuses(
  inventory: InventoryRepository,
  catalog: Catalog,
  heroId: number,
): Promise<void> {
  const items = await inventory.lockForHero(heroId);
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
  const wanted = wantedSetBonusArtikuls(collectWornSets(pieces));
  const existing: InventoryItem[] = [];
  const kept = new Set<number>();
  for (const item of items) {
    if (item.location.kind !== "tempeffect") continue;
    const definition = await catalog.artifact(item.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    if (definition.kindId !== KIND_SET) continue;
    existing.push(item);
  }
  for (const item of existing) {
    if (wanted.includes(item.artifactId) && !kept.has(item.artifactId)) {
      kept.add(item.artifactId);
      continue;
    }
    await inventory.delete(item);
  }
  for (const bonusId of wanted) {
    if (kept.has(bonusId)) continue;
    const definition = await catalog.artifact(bonusId);
    if (!definition) throw new Error(`Artifact catalog entry ${bonusId} is missing`);
    if (definition.kindId !== ARTIFACT_KIND_SET_BONUS) {
      throw new Error(`Artifact ${bonusId} is not a set-bonus article`);
    }
    await inventory.create({
      heroId,
      artifactId: bonusId,
      quantity: 0,
      location: { kind: "tempeffect" },
      durability: definition.durability,
      durabilityMax: definition.durabilityMax,
    });
  }
}

export async function paperdollTrendsAfterWear(
  items: readonly InventoryItem[],
  catalog: Catalog,
  wearing: InventoryItem,
  slot: number,
): Promise<readonly number[]> {
  const trends: number[] = [];
  for (const item of items) {
    if (item.id === wearing.id || item.location.kind !== "equipment") continue;
    if (item.location.slot === slot || (item.location.slot & slot) !== 0) continue;
    const definition = await catalog.artifact(item.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    trends.push(definition.extra.trend);
  }
  const worn = await catalog.artifact(wearing.artifactId);
  if (!worn) throw new Error(`Artifact catalog entry ${wearing.artifactId} is missing`);
  trends.push(worn.extra.trend);
  return trends;
}
