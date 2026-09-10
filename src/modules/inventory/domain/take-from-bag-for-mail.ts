import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { isNogiveFlags } from "./artifact-flags.ts";
import { MailBagTakeError } from "./mail-bag-take-error.ts";
import type { MailItemSnapshot } from "./mail-item-snapshot.ts";

export async function takeFromBagForMail(
  inventory: InventoryRepository,
  catalog: Catalog,
  command: Readonly<{ characterId: number; itemId: number; quantity: number }>,
): Promise<MailItemSnapshot> {
  if (!Number.isInteger(command.quantity) || command.quantity < 1) {
    throw new MailBagTakeError("нечего прикладывать");
  }
  const items = [...(await inventory.lockForHero(command.characterId))];
  const item = items.find((row) => row.id === command.itemId);
  if (!item || item.heroId !== command.characterId || item.location.kind !== "bag") {
    throw new MailBagTakeError("предмет не найден в рюкзаке");
  }
  if (command.quantity > item.quantity) throw new MailBagTakeError("недостаточно предметов");
  const definition = await catalog.artifact(item.artifactId);
  if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
  if (isNogiveFlags(definition.flags) || item.upgrade.bound) {
    throw new MailBagTakeError("непередаваемый предмет нельзя отправить почтой");
  }
  const snapshot: MailItemSnapshot = {
    originalItemId: item.id,
    artifactId: item.artifactId,
    quantity: command.quantity,
    durability: item.durability,
    durabilityMax: item.durabilityMax,
    upgrade: item.upgrade,
  };
  if (command.quantity === item.quantity) await inventory.delete(item);
  else await inventory.save(item.withQuantity(item.quantity - command.quantity));
  return snapshot;
}
