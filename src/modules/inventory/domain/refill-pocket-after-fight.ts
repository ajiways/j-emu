import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryItem } from "./inventory-item.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { pocketCntMax } from "./pocket-slot.ts";
import { EMPTY_ITEM_INSTANCE } from "./item-instance-data.ts";

export type PocketRefillCell = Readonly<{
  itemId: number;
  artifactId: number;
  position: number;
  startCount: number;
  currentCount: number;
}>;

export async function refillPocketAfterFight(
  inventory: InventoryRepository,
  catalog: Catalog,
  command: Readonly<{ characterId: number; cells: readonly PocketRefillCell[] }>,
): Promise<void> {
  const items = [...(await inventory.lockForHero(command.characterId))];
  for (const cell of command.cells) {
    if (cell.currentCount >= cell.startCount) continue;
    const definition = await catalog.artifact(cell.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${cell.artifactId} is missing`);
    const occupant = pocketOccupant(items, command.characterId, cell);
    const have = occupant?.quantity ?? 0;
    const need = pocketCntMax(definition.weight) - have;
    if (need < 1) continue;
    const taken = await takeFromBag(inventory, items, command.characterId, cell.artifactId, need);
    if (taken < 1) continue;
    if (occupant) {
      const next = occupant.withQuantity(have + taken);
      replace(items, next);
      await inventory.save(next);
      continue;
    }
    items.push(
      await inventory.create({
        heroId: command.characterId,
        artifactId: cell.artifactId,
        quantity: taken,
        location: { kind: "pocket", position: cell.position },
        durability: definition.durability,
        durabilityMax: definition.durabilityMax,
        expire: 0,
        data: EMPTY_ITEM_INSTANCE,
      }),
    );
  }
}

function pocketOccupant(
  items: readonly InventoryItem[],
  characterId: number,
  cell: PocketRefillCell,
): InventoryItem | undefined {
  const byId = items.find((item) => item.id === cell.itemId && item.heroId === characterId);
  if (byId?.location.kind === "pocket" && byId.location.position === cell.position) return byId;
  return items.find(
    (item) =>
      item.heroId === characterId &&
      item.artifactId === cell.artifactId &&
      item.location.kind === "pocket" &&
      item.location.position === cell.position,
  );
}

async function takeFromBag(
  inventory: InventoryRepository,
  items: InventoryItem[],
  characterId: number,
  artifactId: number,
  need: number,
): Promise<number> {
  let remaining = need;
  const stacks = items
    .filter(
      (item) =>
        item.heroId === characterId &&
        item.artifactId === artifactId &&
        item.location.kind === "bag",
    )
    .sort((left, right) => left.id - right.id);
  for (const stack of stacks) {
    if (remaining < 1) break;
    const take = Math.min(remaining, stack.quantity);
    remaining -= take;
    const nextQty = stack.quantity - take;
    if (nextQty < 1) {
      await inventory.delete(stack);
      const index = items.findIndex((row) => row.id === stack.id);
      if (index >= 0) items.splice(index, 1);
      continue;
    }
    const next = stack.withQuantity(nextQty);
    replace(items, next);
    await inventory.save(next);
  }
  return need - remaining;
}

function replace(items: InventoryItem[], next: InventoryItem): void {
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) throw new Error(`Item ${next.id} is missing from pocket refill`);
  items[index] = next;
}
