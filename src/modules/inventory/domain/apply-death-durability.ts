import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryItem } from "./inventory-item.ts";
import { applyBreak, instanceDurability, pickDeathBreaks, tracksDurability } from "./durability.ts";
import { isPaperdollSlotMask } from "./paperdoll-slot.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";

export type ApplyDeathDurabilityCommand = Readonly<{
  characterId: number;
  random: Readonly<{ unit(): number }>;
}>;

export type DeathDurabilityResult = Readonly<{
  paperdollChanged: boolean;
}>;

export async function applyDeathDurability(
  inventory: InventoryRepository,
  catalog: Catalog,
  command: ApplyDeathDurabilityCommand,
): Promise<DeathDurabilityResult> {
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
  for (const item of picked) {
    const flags = flagsByItem.get(item.id);
    if (flags === undefined) throw new Error(`Death-break flags for item ${item.id} are missing`);
    const before = instanceDurability(item.durability, item.durabilityMax, flags);
    const next = applyBreak(before.current, before.max, before.infinite);
    if (next.destroy) {
      await inventory.delete(item);
      paperdollChanged = true;
      continue;
    }
    let updated = item.withDurability(next.current, next.max);
    if (next.current <= 0) {
      updated = updated.withLocation({ kind: "bag" });
      paperdollChanged = true;
    }
    await inventory.save(updated);
  }
  return { paperdollChanged };
}
