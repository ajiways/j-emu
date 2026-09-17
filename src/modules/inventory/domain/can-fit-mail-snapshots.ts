import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { isNoweightFlags } from "./artifact-flags.ts";
import { computeBagLoad } from "./bag-load.ts";
import type { InventoryItem } from "./inventory-item.ts";
import type { MailItemSnapshot } from "./mail-item-snapshot.ts";
import { isPaperdollSlotMask } from "./paperdoll-slot.ts";

type StackKey = string;

export async function canFitMailSnapshots(
  inventory: InventoryRepository,
  catalog: Catalog,
  bagCapacity: number,
  command: Readonly<{ characterId: number; snapshots: readonly MailItemSnapshot[] }>,
): Promise<boolean> {
  if (command.snapshots.length < 1) return true;
  const items = await inventory.lockForHero(command.characterId);
  const definitions = await loadDefinitions(catalog, items, command.snapshots);
  const load = computeBagLoad(items, definitions, bagCapacity);
  let amount = load.amount;
  const stacks: Array<{ key: StackKey; quantity: number }> = [];
  for (const item of items) {
    if (item.location.kind !== "bag") continue;
    stacks.push({
      key: stackKey({
        artifactId: item.artifactId,
        durability: item.durability,
        durabilityMax: item.durabilityMax,
        upgrade: item.upgrade,
        data: item.data,
      }),
      quantity: item.quantity,
    });
  }
  for (const snap of command.snapshots) {
    const definition = definitions.get(snap.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${snap.artifactId} is missing`);
    const newSlots = applySnapshot(stacks, snap, definition);
    if (isNoweightFlags(definition.flags)) continue;
    amount += newSlots;
    if (amount > load.amountMax) return false;
  }
  return true;
}

function applySnapshot(
  stacks: Array<{ key: StackKey; quantity: number }>,
  snap: MailItemSnapshot,
  definition: ArtifactDefinition,
): number {
  if (isPaperdollSlotMask(definition.slotMask)) return 1;
  let left = snap.quantity;
  const key = stackKey(snap);
  for (const stack of stacks) {
    if (stack.key !== key || left < 1) continue;
    const room = Math.max(0, definition.bagStack - stack.quantity);
    const use = Math.min(left, room);
    stack.quantity += use;
    left -= use;
  }
  let newSlots = 0;
  while (left > 0) {
    const take = Math.min(left, definition.bagStack);
    stacks.push({ key, quantity: take });
    left -= take;
    newSlots += 1;
  }
  return newSlots;
}

function stackKey(
  snap: Pick<MailItemSnapshot, "artifactId" | "durability" | "durabilityMax" | "upgrade" | "data">,
): StackKey {
  return [
    snap.artifactId,
    snap.durability,
    snap.durabilityMax,
    snap.upgrade.id,
    snap.upgrade.level,
    snap.upgrade.skillId,
    snap.upgrade.bound ? 1 : 0,
    JSON.stringify(snap.data),
  ].join(":");
}

async function loadDefinitions(
  catalog: Catalog,
  items: readonly InventoryItem[],
  snapshots: readonly MailItemSnapshot[],
): Promise<Map<number, ArtifactDefinition>> {
  const definitions = new Map<number, ArtifactDefinition>();
  const ids = new Set<number>();
  for (const item of items) ids.add(item.artifactId);
  for (const snap of snapshots) ids.add(snap.artifactId);
  for (const artifactId of ids) {
    const definition = await catalog.artifact(artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${artifactId} is missing`);
    definitions.set(artifactId, definition);
  }
  return definitions;
}
