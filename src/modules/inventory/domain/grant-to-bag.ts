import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryItem } from "./inventory-item.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { BagFullError } from "./bag-full-error.ts";
import { computeBagLoad } from "./bag-load.ts";
import { MissingArtifactError } from "./missing-artifact-error.ts";
import { itemInstanceDataForGrant } from "./roll-glove-instance.ts";

export async function grantToBag(
  inventory: InventoryRepository,
  catalog: Catalog,
  bagCapacity: number,
  random: Readonly<{ unit(): number }>,
  command: Readonly<{ characterId: number; artifactId: number; quantity: number }>,
): Promise<void> {
  if (!Number.isInteger(command.quantity) || command.quantity < 1) {
    throw new Error("Bag grant quantity must be a positive integer");
  }
  const definition = await catalog.artifact(command.artifactId);
  if (!definition) throw new MissingArtifactError(command.artifactId);
  const items = [...(await inventory.lockForHero(command.characterId))];
  const definitions = await definitionsFor(catalog, items, definition);
  let remaining = command.quantity;
  const stacks = items
    .filter(
      (item) =>
        item.heroId === command.characterId &&
        item.artifactId === command.artifactId &&
        item.location.kind === "bag",
    )
    .sort((left, right) => left.id - right.id);
  for (const stack of stacks) {
    if (remaining < 1) break;
    const room = definition.bagStack - stack.quantity;
    if (room < 1) continue;
    const move = Math.min(remaining, room);
    const next = stack.withQuantity(stack.quantity + move);
    replace(items, next);
    await inventory.save(next);
    remaining -= move;
  }
  while (remaining > 0) {
    const load = computeBagLoad(items, definitions, bagCapacity);
    if (load.amount >= load.amountMax) {
      throw new BagFullError(command.characterId);
    }
    const take = Math.min(remaining, definition.bagStack);
    const created = await inventory.create({
      heroId: command.characterId,
      artifactId: command.artifactId,
      quantity: take,
      location: { kind: "bag" },
      durability: definition.durability,
      durabilityMax: definition.durabilityMax,
      expire: 0,
      data: itemInstanceDataForGrant(definition, random),
    });
    items.push(created);
    remaining -= take;
  }
}

function replace(items: InventoryItem[], next: InventoryItem): void {
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) throw new Error(`Item ${next.id} is missing from bag grant`);
  items[index] = next;
}

async function definitionsFor(
  catalog: Catalog,
  items: readonly InventoryItem[],
  granted: ArtifactDefinition,
): Promise<Map<number, ArtifactDefinition>> {
  const definitions = new Map<number, ArtifactDefinition>([[granted.id, granted]]);
  for (const item of items) {
    if (definitions.has(item.artifactId)) continue;
    const definition = await catalog.artifact(item.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    definitions.set(item.artifactId, definition);
  }
  return definitions;
}
