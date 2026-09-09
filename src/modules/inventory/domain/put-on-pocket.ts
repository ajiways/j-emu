import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { NewInventoryItem } from "../ports/inventory-repository.ts";
import type { InventoryItem, ItemLocation } from "./inventory-item.ts";
import { planMergeBagStacks } from "./merge-bag-stacks.ts";
import { PocketDeniedError } from "./pocket-denied-error.ts";
import { isLeftPocket, pocketCntMax, requirePocketCapacity } from "./pocket-slot.ts";

type PocketOccupant = InventoryItem & { location: Extract<ItemLocation, { kind: "pocket" }> };

export type PocketTarget = number | "auto";

export type PocketMutation = Readonly<{
  save: readonly InventoryItem[];
  create: readonly NewInventoryItem[];
  delete: readonly InventoryItem[];
}>;

export function planPutOnPocket(input: {
  items: readonly InventoryItem[];
  itemId: number;
  definition: ArtifactDefinition;
  capacity: number;
  target: PocketTarget;
}): PocketMutation {
  const capacity = requirePocketCapacity(input.capacity);
  if (!isLeftPocket(input.definition.slotMask)) throw PocketDeniedError.notWearable();
  const item = requireItem(input.items, input.itemId);
  if (item.artifactId !== input.definition.id) {
    throw new Error(`Item ${item.id} catalog id ${item.artifactId} does not match`);
  }
  if (item.location.kind !== "bag" && item.location.kind !== "pocket") {
    throw PocketDeniedError.notWearable();
  }
  const maxCnt = pocketCntMax(input.definition.weight);
  const others = pocketExcept(input.items, item.id);
  const slot = resolveSlot(input.target, capacity, item, others, maxCnt);
  if (isPocketOccupant(item) && item.location.position === slot) return emptyMutation();
  const dest = others.find((row) => row.location.position === slot);
  if (isPocketOccupant(item)) return fromPocketMove(item, dest, slot, maxCnt);
  return fromBagMove(input.items, item, dest, others, slot, maxCnt, capacity, input.definition);
}

function fromBagMove(
  items: readonly InventoryItem[],
  item: InventoryItem,
  dest: PocketOccupant | undefined,
  others: readonly PocketOccupant[],
  slot: number,
  maxCnt: number,
  capacity: number,
  definition: ArtifactDefinition,
): PocketMutation {
  if (!dest) return placeIntoSlot(item, slot, maxCnt);
  if (dest.artifactId === item.artifactId) {
    const room = maxCnt - dest.quantity;
    if (room > 0) return mergeInto(dest, item, room);
    const alt = firstFree(capacity, others);
    if (alt == null) throw PocketDeniedError.noCells();
    return placeIntoSlot(item, alt, maxCnt);
  }
  return displace(items, item, dest, slot, maxCnt, definition.bagStack);
}

function fromPocketMove(
  item: PocketOccupant,
  dest: PocketOccupant | undefined,
  slot: number,
  maxCnt: number,
): PocketMutation {
  if (!dest) return placeIntoSlot(item, slot, maxCnt);
  if (dest.artifactId === item.artifactId) {
    const room = maxCnt - dest.quantity;
    if (room < 1) throw PocketDeniedError.noCells();
    return mergeInto(dest, item, room);
  }
  const srcSlot = item.location.position;
  return {
    save: [
      item.withLocation({ kind: "bag" }),
      dest.withLocation({ kind: "pocket", position: srcSlot }),
      item.withLocation({ kind: "pocket", position: slot }),
    ],
    create: [],
    delete: [],
  };
}

function displace(
  items: readonly InventoryItem[],
  item: InventoryItem,
  dest: InventoryItem,
  slot: number,
  maxCnt: number,
  bagStack: number,
): PocketMutation {
  const toBag = dest.withLocation({ kind: "bag" });
  const merged = planMergeBagStacks(
    [...items.filter((row) => row.id !== dest.id), toBag],
    toBag,
    bagStack,
  );
  const placed = placeIntoSlot(item, slot, maxCnt);
  return {
    save: [...merged.save, ...placed.save],
    create: placed.create,
    delete: [...merged.delete, ...placed.delete],
  };
}

function placeIntoSlot(item: InventoryItem, slot: number, maxCnt: number): PocketMutation {
  const move = Math.min(item.quantity, maxCnt);
  if (move < item.quantity) {
    return {
      save: [item.withQuantity(item.quantity - move)],
      create: [
        {
          heroId: item.heroId,
          artifactId: item.artifactId,
          quantity: move,
          location: { kind: "pocket", position: slot },
          durability: item.durability,
          durabilityMax: item.durabilityMax,
        },
      ],
      delete: [],
    };
  }
  return {
    save: [item.withLocation({ kind: "pocket", position: slot })],
    create: [],
    delete: [],
  };
}

function mergeInto(dest: InventoryItem, source: InventoryItem, room: number): PocketMutation {
  const move = Math.min(source.quantity, room);
  const save = [dest.withQuantity(dest.quantity + move)];
  if (move >= source.quantity) return { save, create: [], delete: [source] };
  return { save: [...save, source.withQuantity(source.quantity - move)], create: [], delete: [] };
}

function resolveSlot(
  target: PocketTarget,
  capacity: number,
  item: InventoryItem,
  others: readonly PocketOccupant[],
  maxCnt: number,
): number {
  if (target !== "auto") {
    if (!Number.isInteger(target) || target < 1 || target > capacity) {
      throw PocketDeniedError.notWearable();
    }
    return target;
  }
  const merge = others.find((row) => row.artifactId === item.artifactId && row.quantity < maxCnt);
  if (merge && merge.location.kind === "pocket") return merge.location.position;
  const free = firstFree(capacity, others);
  if (free == null) throw PocketDeniedError.noCells();
  return free;
}

function firstFree(capacity: number, others: readonly PocketOccupant[]): number | undefined {
  const used = new Set(others.map((row) => row.location.position));
  for (let slot = 1; slot <= capacity; slot += 1) {
    if (!used.has(slot)) return slot;
  }
  return undefined;
}

function pocketExcept(items: readonly InventoryItem[], itemId: number): PocketOccupant[] {
  return items.filter(
    (item): item is PocketOccupant => item.id !== itemId && isPocketOccupant(item),
  );
}

function isPocketOccupant(item: InventoryItem): item is PocketOccupant {
  return item.location.kind === "pocket";
}

function requireItem(items: readonly InventoryItem[], itemId: number): InventoryItem {
  const matches = items.filter((item) => item.id === itemId);
  if (matches.length > 1) throw new Error(`Multiple items found for ${itemId}`);
  const item = matches[0];
  if (!item) throw new Error(`Item ${itemId} is missing`);
  return item;
}

function emptyMutation(): PocketMutation {
  return { save: [], create: [], delete: [] };
}
