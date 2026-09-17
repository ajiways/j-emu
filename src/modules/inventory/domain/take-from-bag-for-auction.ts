import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { AuctionBagTakeError } from "./auction-bag-take-error.ts";
import { isClanThingFlags, isNogiveFlags } from "./artifact-flags.ts";
import { mailItemSnapshotFromItem, type MailItemSnapshot } from "./mail-item-snapshot.ts";

export async function takeFromBagForAuction(
  inventory: InventoryRepository,
  catalog: Catalog,
  command: Readonly<{ characterId: number; itemId: number; quantity: number }>,
): Promise<MailItemSnapshot> {
  if (!Number.isInteger(command.quantity) || command.quantity < 1) {
    throw new AuctionBagTakeError("предмет не найден в рюкзаке");
  }
  const items = [...(await inventory.lockForHero(command.characterId))];
  const item = items.find((row) => row.id === command.itemId);
  if (!item || item.heroId !== command.characterId || item.location.kind !== "bag") {
    throw new AuctionBagTakeError("предмет не найден в рюкзаке");
  }
  if (command.quantity > item.quantity)
    throw new AuctionBagTakeError("предмет не найден в рюкзаке");
  const definition = await catalog.artifact(item.artifactId);
  if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
  if (isNogiveFlags(definition.flags) || isClanThingFlags(definition.flags) || item.upgrade.bound) {
    throw new AuctionBagTakeError("непередаваемый предмет");
  }
  const snapshot = mailItemSnapshotFromItem(item, command.quantity);
  if (command.quantity === item.quantity) await inventory.delete(item);
  else await inventory.save(item.withQuantity(item.quantity - command.quantity));
  return snapshot;
}
