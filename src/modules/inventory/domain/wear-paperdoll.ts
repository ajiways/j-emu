import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { InventoryItem } from "./inventory-item.ts";
import { isPaperdollSlotMask, pickPaperdollSlot } from "./paperdoll-slot.ts";
import { WearDeniedError } from "./wear-denied-error.ts";

export type WearHero = Readonly<{
  id: number;
  level: number;
  gender: number;
}>;

export function requireWearablePaperdoll(
  hero: WearHero,
  item: InventoryItem,
  definition: ArtifactDefinition,
  occupied: ReadonlySet<number>,
): number {
  if (item.heroId !== hero.id) {
    throw new Error(`Item ${item.id} does not belong to hero ${hero.id}`);
  }
  if (item.artifactId !== definition.id) {
    throw new Error(
      `Item ${item.id} catalog id ${item.artifactId} does not match ${definition.id}`,
    );
  }
  if (item.location.kind !== "bag") {
    throw new WearDeniedError("Этот предмет нельзя надеть");
  }
  if (!isPaperdollSlotMask(definition.slotMask)) {
    throw new WearDeniedError("Этот предмет нельзя надеть");
  }
  if (definition.levelMin > 0 && hero.level < definition.levelMin) {
    throw new WearDeniedError(`С ${definition.levelMin} уровня!`);
  }
  if (
    definition.levelMax > 0 &&
    definition.levelMax < 100_000 &&
    hero.level > definition.levelMax
  ) {
    throw new WearDeniedError(`До ${definition.levelMax} уровня!`);
  }
  if (definition.gender > 0 && definition.gender !== hero.gender) {
    throw new WearDeniedError("Этот предмет нельзя надеть");
  }
  const slot = pickPaperdollSlot(definition.slotMask, occupied);
  if (slot == null) throw new WearDeniedError("Этот предмет нельзя надеть");
  return slot;
}

export function requireEquippedItem(item: InventoryItem, heroId: number): number {
  if (item.heroId !== heroId) {
    throw new Error(`Item ${item.id} does not belong to hero ${heroId}`);
  }
  if (item.location.kind !== "equipment") {
    throw new WearDeniedError("Этот предмет нельзя снять");
  }
  return item.location.slot;
}
