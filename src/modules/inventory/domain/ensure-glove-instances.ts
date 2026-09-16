import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import type { InventoryItem } from "./inventory-item.ts";
import { isRolledGloveInstance } from "./item-instance-data.ts";
import { rollGloveInstance } from "./roll-glove-instance.ts";

export async function ensureGloveInstances(
  inventory: InventoryRepository,
  catalog: Catalog,
  random: Readonly<{ unit(): number }>,
  items: readonly InventoryItem[],
): Promise<readonly InventoryItem[]> {
  const next: InventoryItem[] = [];
  for (const item of items) {
    const definition = await catalog.artifact(item.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    const sockets = definition.extra.sockets;
    if (sockets.length < 1 || isRolledGloveInstance(item.data, sockets.length)) {
      next.push(item);
      continue;
    }
    const rolled = item.withData(rollGloveInstance(definition.extra, () => random.unit()));
    await inventory.save(rolled);
    next.push(rolled);
  }
  return next;
}
