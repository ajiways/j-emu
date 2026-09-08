import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import { isNoweightFlags } from "./artifact-flags.ts";
import type { InventoryItem } from "./inventory-item.ts";

export type BagLoad = Readonly<{
  amount: number;
  total: number;
  amountMax: number;
}>;

export function computeBagLoad(
  items: readonly InventoryItem[],
  definitions: ReadonlyMap<number, ArtifactDefinition>,
  bagCapacity: number,
): BagLoad {
  if (!Number.isInteger(bagCapacity) || bagCapacity < 1) {
    throw new Error("Bag capacity must be a positive integer");
  }
  let amount = 0;
  let total = 0;
  let capacityBonus = 0;
  for (const item of items) {
    const definition = definitions.get(item.artifactId);
    if (!definition) {
      throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    }
    if (item.location.kind === "bag") {
      total += 1;
      if (!isNoweightFlags(definition.flags)) amount += 1;
    }
    if (item.location.kind !== "equipment") continue;
    for (const skill of definition.skills) {
      if (skill.id !== "CAPACITY") continue;
      capacityBonus += skill.value;
    }
  }
  if (!Number.isInteger(capacityBonus) || capacityBonus < 0) {
    throw new Error("Equipped CAPACITY bonus is invalid");
  }
  return { amount, total, amountMax: bagCapacity + capacityBonus };
}
