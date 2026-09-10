import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { computeBagLoad } from "./bag-load.ts";
import type { InventoryItem } from "./inventory-item.ts";
import { MailBagFullError } from "./mail-bag-full-error.ts";
import type { MailItemSnapshot } from "./mail-item-snapshot.ts";
import { isPaperdollSlotMask } from "./paperdoll-slot.ts";

export async function grantMailSnapshots(
  inventory: InventoryRepository,
  catalog: Catalog,
  bagCapacity: number,
  command: Readonly<{ characterId: number; snapshots: readonly MailItemSnapshot[] }>,
): Promise<void> {
  const items = [...(await inventory.lockForHero(command.characterId))];
  const definitions = new Map<number, ArtifactDefinition>();
  for (const snap of command.snapshots) {
    const definition = await catalog.artifact(snap.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${snap.artifactId} is missing`);
    definitions.set(snap.artifactId, definition);
    await grantOne(inventory, catalog, bagCapacity, items, definitions, command.characterId, snap);
  }
}

async function grantOne(
  inventory: InventoryRepository,
  catalog: Catalog,
  bagCapacity: number,
  items: InventoryItem[],
  definitions: Map<number, ArtifactDefinition>,
  characterId: number,
  snap: MailItemSnapshot,
): Promise<void> {
  const definition = definitions.get(snap.artifactId);
  if (!definition) throw new Error(`Artifact catalog entry ${snap.artifactId} is missing`);
  await ensureDefinition(catalog, items, definitions);
  let remaining = snap.quantity;
  if (!isPaperdollSlotMask(definition.slotMask)) {
    remaining = await mergeIntoStacks(inventory, items, snap, definition, remaining);
  }
  while (remaining > 0) {
    const load = computeBagLoad(items, definitions, bagCapacity);
    if (load.amount >= load.amountMax) throw new MailBagFullError();
    const take = Math.min(remaining, definition.bagStack);
    const created = await inventory.create({
      heroId: characterId,
      artifactId: snap.artifactId,
      quantity: take,
      location: { kind: "bag" },
      durability: snap.durability,
      durabilityMax: snap.durabilityMax,
      expire: 0,
      upgrade: snap.upgrade,
    });
    items.push(created);
    remaining -= take;
  }
}

async function mergeIntoStacks(
  inventory: InventoryRepository,
  items: InventoryItem[],
  snap: MailItemSnapshot,
  definition: ArtifactDefinition,
  remaining: number,
): Promise<number> {
  let left = remaining;
  const stacks = items
    .filter((item) => sameStack(item, snap))
    .sort((leftStack, rightStack) => leftStack.id - rightStack.id);
  for (const stack of stacks) {
    if (left < 1) break;
    const room = definition.bagStack - stack.quantity;
    if (room < 1) continue;
    const move = Math.min(left, room);
    const next = stack.withQuantity(stack.quantity + move);
    replace(items, next);
    await inventory.save(next);
    left -= move;
  }
  return left;
}

function sameStack(item: InventoryItem, snap: MailItemSnapshot): boolean {
  return (
    item.location.kind === "bag" &&
    item.artifactId === snap.artifactId &&
    item.durability === snap.durability &&
    item.durabilityMax === snap.durabilityMax &&
    item.upgrade.id === snap.upgrade.id &&
    item.upgrade.level === snap.upgrade.level &&
    item.upgrade.skillId === snap.upgrade.skillId &&
    item.upgrade.bound === snap.upgrade.bound
  );
}

function replace(items: InventoryItem[], next: InventoryItem): void {
  const index = items.findIndex((item) => item.id === next.id);
  if (index < 0) throw new Error(`Item ${next.id} is missing from mail grant`);
  items[index] = next;
}

async function ensureDefinition(
  catalog: Catalog,
  items: readonly InventoryItem[],
  definitions: Map<number, ArtifactDefinition>,
): Promise<void> {
  for (const item of items) {
    if (definitions.has(item.artifactId)) continue;
    const definition = await catalog.artifact(item.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    definitions.set(item.artifactId, definition);
  }
}
