import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { isNoweightFlags } from "./artifact-flags.ts";
import { computeBagLoad } from "./bag-load.ts";

export async function canFitBag(
  inventory: InventoryRepository,
  catalog: Catalog,
  bagCapacity: number,
  command: Readonly<{ characterId: number; artifactId: number; quantity: number }>,
): Promise<boolean> {
  if (!Number.isInteger(command.quantity) || command.quantity < 1) {
    throw new Error("Bag fit quantity must be a positive integer");
  }
  const definition = await catalog.artifact(command.artifactId);
  if (!definition) throw new Error(`Artifact catalog entry ${command.artifactId} is missing`);
  const items = await inventory.lockForHero(command.characterId);
  const definitions = new Map<number, ArtifactDefinition>([[definition.id, definition]]);
  for (const item of items) {
    if (definitions.has(item.artifactId)) continue;
    const other = await catalog.artifact(item.artifactId);
    if (!other) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    definitions.set(item.artifactId, other);
  }
  let remaining = command.quantity;
  const stacks = items
    .filter(
      (item) =>
        item.heroId === command.characterId &&
        item.artifactId === command.artifactId &&
        item.location.kind === "bag",
    )
    .map((item) => item.quantity);
  for (let index = 0; index < stacks.length; index += 1) {
    if (remaining < 1) break;
    const quantity = stacks[index];
    if (quantity === undefined) throw new Error("Bag stack quantity is missing");
    const room = definition.bagStack - quantity;
    if (room < 1) continue;
    const move = Math.min(remaining, room);
    remaining -= move;
  }
  if (remaining < 1) return true;
  if (isNoweightFlags(definition.flags)) return true;
  const load = computeBagLoad(items, definitions, bagCapacity);
  let amount = load.amount;
  while (remaining > 0) {
    if (amount >= load.amountMax) return false;
    remaining -= Math.min(remaining, definition.bagStack);
    amount += 1;
  }
  return true;
}
