import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { UseScript } from "../../catalog/domain/use-script.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";
import { consumeFromBag, countBagByArtifact } from "./consume-from-bag.ts";
import { grantToBag } from "./grant-to-bag.ts";
import { UseDeniedError } from "./use-denied-error.ts";

export async function applyUseScript(
  inventory: InventoryRepository,
  catalog: Catalog,
  bagCapacity: number,
  random: Readonly<{ unit(): number }>,
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
    if (countBagByArtifact(items, command.characterId, row.artikulId) < row.count) {
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
    await grantToBag(inventory, catalog, bagCapacity, random, {
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
