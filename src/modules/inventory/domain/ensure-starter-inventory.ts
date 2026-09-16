import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import type { StarterItemSpec } from "./inventory-service.ts";
import { itemInstanceDataForGrant } from "./roll-glove-instance.ts";

export async function grantStarterInventory(
  inventory: InventoryRepository,
  catalog: Catalog,
  random: Readonly<{ unit(): number }>,
  starterItems: readonly StarterItemSpec[],
  heroId: number,
): Promise<void> {
  if ((await inventory.listForHero(heroId)).length > 0) return;
  for (const spec of starterItems) {
    const definition = await catalog.artifact(spec.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${spec.artifactId} is missing`);
    await inventory.create({
      heroId,
      artifactId: spec.artifactId,
      quantity: spec.quantity,
      location: spec.location,
      durability: definition.durability,
      durabilityMax: definition.durabilityMax,
      expire: 0,
      data: itemInstanceDataForGrant(definition, random),
    });
  }
}
