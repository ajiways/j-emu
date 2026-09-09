import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { UseScript } from "../../catalog/domain/use-script.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { grantToBag } from "./grant-to-bag.ts";
import type { InventoryItem } from "./inventory-item.ts";
import { UseDeniedError } from "./use-denied-error.ts";

export async function applyUseScript(
  inventory: InventoryRepository,
  catalog: Catalog,
  bagCapacity: number,
  command: Readonly<{
    characterId: number;
    script: UseScript;
    description: string;
  }>,
): Promise<void> {
  for (const effect of command.script.effects) {
    if (effect.type === "openDialog") {
      throw UseDeniedError.unsupported("openDialog");
    }
  }
  const items = [...(await inventory.lockForHero(command.characterId))];
  for (const row of command.script.require) {
    if (bagCount(items, command.characterId, row.artikulId) < row.count) {
      throw new UseDeniedError(
        scriptShortageMessage(command.script.failPlaque, command.description),
      );
    }
  }
  for (const effect of command.script.effects) {
    if (effect.type !== "consume") continue;
    await consumeFromBag(inventory, items, command.characterId, effect.artikulId, effect.count);
  }
  for (const effect of command.script.effects) {
    if (effect.type !== "grant") continue;
    await grantToBag(inventory, catalog, bagCapacity, {
      characterId: command.characterId,
      artifactId: effect.artikulId,
      quantity: effect.count,
    });
  }
}

function scriptShortageMessage(failPlaque: string, description: string): string {
  if (failPlaque.length > 0) return failPlaque;
  if (description.length > 0) return description;
  return "недостаточно предметов";
}

function bagCount(items: readonly InventoryItem[], heroId: number, artifactId: number): number {
  let total = 0;
  for (const item of items) {
    if (item.heroId !== heroId || item.artifactId !== artifactId) continue;
    if (item.location.kind !== "bag") continue;
    total += item.quantity;
  }
  return total;
}

async function consumeFromBag(
  inventory: InventoryRepository,
  items: InventoryItem[],
  heroId: number,
  artifactId: number,
  count: number,
): Promise<void> {
  let remaining = count;
  const stacks = items
    .filter(
      (item) =>
        item.heroId === heroId && item.artifactId === artifactId && item.location.kind === "bag",
    )
    .sort((left, right) => left.id - right.id);
  for (const stack of stacks) {
    if (remaining < 1) return;
    if (stack.quantity <= remaining) {
      remaining -= stack.quantity;
      await inventory.delete(stack);
      replaceRemoved(items, stack.id);
      continue;
    }
    const next = stack.withQuantity(stack.quantity - remaining);
    remaining = 0;
    await inventory.save(next);
    replaceItem(items, next);
  }
  if (remaining > 0) {
    throw new Error(`Bag consume of ${artifactId} left ${remaining} unpaid`);
  }
}

function replaceItem(items: InventoryItem[], next: InventoryItem): void {
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) throw new Error(`Item ${next.id} is missing from use-script consume`);
  items[index] = next;
}

function replaceRemoved(items: InventoryItem[], itemId: number): void {
  const index = items.findIndex((item) => item.id === itemId);
  if (index < 0) throw new Error(`Item ${itemId} is missing from use-script consume`);
  items.splice(index, 1);
}
