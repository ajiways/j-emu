import type { ArtifactDefinition } from "../../catalog/domain/artifact-definition.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { drinkDisplaceIds, drinkExpireAt, isTempEffectMask } from "./drink-displace.ts";
import type { InventoryItem } from "./inventory-item.ts";
import { EMPTY_ITEM_INSTANCE } from "./item-instance-data.ts";
import { UseDeniedError } from "./use-denied-error.ts";

export async function applyDrink(
  inventory: InventoryRepository,
  catalog: Catalog,
  command: Readonly<{
    characterId: number;
    item: InventoryItem;
    definition: ArtifactDefinition;
    nowSec: number;
  }>,
): Promise<void> {
  const { item, definition } = command;
  if (!isTempEffectMask(definition.slotMask)) {
    throw new UseDeniedError("Этот предмет нельзя использовать так");
  }
  const expire = drinkExpireAt(definition.extra.flagsExt, definition.extra.param1, command.nowSec);
  const items = await inventory.lockForHero(command.characterId);
  const peers: { id: number; artifactId: number; typeId: string; kindId: number }[] = [];
  const equipped = new Map<number, InventoryItem>();
  for (const row of items) {
    if (row.location.kind !== "tempeffect") continue;
    const peer = await catalog.artifact(row.artifactId);
    if (!peer) throw new Error(`Artifact catalog entry ${row.artifactId} is missing`);
    equipped.set(row.id, row);
    peers.push({
      id: row.id,
      artifactId: row.artifactId,
      typeId: peer.typeId,
      kindId: peer.kindId,
    });
  }
  const drop = drinkDisplaceIds(peers, {
    id: item.id,
    artifactId: item.artifactId,
    typeId: definition.typeId,
  });
  for (const id of drop) {
    const row = equipped.get(id);
    if (!row) throw new Error(`Tempeffect ${id} is missing from drink displace`);
    await inventory.delete(row);
  }
  if (item.quantity <= 1) {
    await inventory.save(item.asTempeffect(expire));
    return;
  }
  await inventory.save(item.withQuantity(item.quantity - 1));
  await inventory.create({
    heroId: command.characterId,
    artifactId: item.artifactId,
    quantity: 0,
    location: { kind: "tempeffect" },
    durability: definition.durability,
    durabilityMax: definition.durabilityMax,
    expire,
    data: EMPTY_ITEM_INSTANCE,
  });
}
