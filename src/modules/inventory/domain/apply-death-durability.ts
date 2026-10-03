import type { Catalog } from "../../catalog/ports/catalog.ts";
import { syncGearSetBonuses } from "./apply-gear-set-bonuses.ts";
import type { InventoryItem } from "./inventory-item.ts";
import { applyBreak, instanceDurability, pickDeathBreaks, tracksDurability } from "./durability.ts";
import { isPaperdollSlotMask } from "./paperdoll-slot.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";

export type ApplyDeathDurabilityCommand = Readonly<{
  characterId: number;
  random: Readonly<{ unit(): number }>;
}>;

export type DeathDurabilityBreak = Readonly<{
  itemId: number;
  artifactId: number;
  durability: number;
  durabilityMax: number;
  slot: number;
}>;

export type DeathDurabilityResult = Readonly<{
  paperdollChanged: boolean;
  breaks: readonly DeathDurabilityBreak[];
}>;

type DeathDurabilityWork = DeathDurabilityResult &
  Readonly<{
    unequipItemIds: readonly number[];
  }>;

type PutOffPaperdoll = (heroId: number, itemId: number) => Promise<"paperdoll" | "pocket">;

export async function applyDeathBreaks(
  inventory: InventoryRepository,
  catalog: Catalog,
  command: ApplyDeathDurabilityCommand,
  putOff: PutOffPaperdoll,
): Promise<DeathDurabilityResult> {
  const worked = await applyDeathDurability(inventory, catalog, command);
  for (const itemId of worked.unequipItemIds) {
    const kind = await putOff(command.characterId, itemId);
    if (kind !== "paperdoll") {
      throw new Error(`Death-break item ${itemId} did not leave the paperdoll`);
    }
  }
  if (worked.paperdollChanged && worked.unequipItemIds.length === 0) {
    await syncGearSetBonuses(inventory, catalog, command.characterId);
  }
  return { paperdollChanged: worked.paperdollChanged, breaks: worked.breaks };
}

async function applyDeathDurability(
  inventory: InventoryRepository,
  catalog: Catalog,
  command: ApplyDeathDurabilityCommand,
): Promise<DeathDurabilityWork> {
  const items = await inventory.lockForHero(command.characterId);
  const pool: InventoryItem[] = [];
  const flagsByItem = new Map<number, number>();
  for (const item of items) {
    if (item.location.kind !== "equipment") continue;
    const definition = await catalog.artifact(item.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    if (!isPaperdollSlotMask(definition.slotMask)) continue;
    const durability = instanceDurability(item.durability, item.durabilityMax, definition.flags);
    if (!tracksDurability(durability) || durability.current <= 0) continue;
    pool.push(item);
    flagsByItem.set(item.id, definition.flags);
  }
  const picked = pickDeathBreaks(pool, command.random);
  let paperdollChanged = false;
  const unequipItemIds: number[] = [];
  const breaks: DeathDurabilityBreak[] = [];
  for (const item of picked) {
    if (item.location.kind !== "equipment") {
      throw new Error(`Death-break item ${item.id} is not equipped`);
    }
    const flags = flagsByItem.get(item.id);
    if (flags === undefined) throw new Error(`Death-break flags for item ${item.id} are missing`);
    const before = instanceDurability(item.durability, item.durabilityMax, flags);
    const next = applyBreak(before.current, before.max, before.infinite);
    const chatCurrent = next.destroy ? 0 : next.current;
    breaks.push({
      itemId: item.id,
      artifactId: item.artifactId,
      durability: chatCurrent,
      durabilityMax: next.max,
      slot: next.destroy || chatCurrent <= 0 ? 0 : item.location.slot,
    });
    if (next.destroy) {
      await inventory.delete(item);
      paperdollChanged = true;
      continue;
    }
    await inventory.save(item.withDurability(next.current, next.max));
    if (next.current <= 0) {
      unequipItemIds.push(item.id);
      paperdollChanged = true;
    }
  }
  return { paperdollChanged, unequipItemIds, breaks };
}
