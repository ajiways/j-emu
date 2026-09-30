import type { Catalog } from "../../modules/catalog/ports/catalog.ts";
import type { Hero } from "../../modules/character/domain/hero.ts";
import type { InventoryService } from "../../modules/inventory/domain/inventory-service.ts";
import type { UnitOfWork } from "../../shared/kernel/unit-of-work.ts";

type PocketDeps = Readonly<{
  unitOfWork: UnitOfWork;
  inventory: InventoryService;
  catalog: Catalog;
}>;

/**
 * Gives the hero the scenario's pocket items (real inventory changes) and puts them in his
 * pocket, topping up what is already there; a fight then reads them as his own loadout.
 */
export async function provisionPocket(
  hero: Hero,
  entries: readonly Readonly<{ artikulId: number; count: number }>[],
  deps: PocketDeps,
): Promise<void> {
  for (const entry of entries) {
    await deps.unitOfWork.run(async () => {
      const inPocket = (await deps.inventory.list(hero.id))
        .filter((item) => item.artifactId === entry.artikulId && item.location.kind === "pocket")
        .reduce((sum, item) => sum + item.quantity, 0);
      if (inPocket >= entry.count) return;
      const definition = await deps.catalog.artifact(entry.artikulId);
      if (!definition) throw new Error(`Scenario pocket artifact ${entry.artikulId} is missing`);
      await deps.inventory.grantToBag({
        characterId: hero.id,
        artifactId: entry.artikulId,
        quantity: entry.count - inPocket,
      });
      const stack = (await deps.inventory.list(hero.id)).find(
        (item) => item.artifactId === entry.artikulId && item.location.kind === "bag",
      );
      if (!stack)
        throw new Error(`Scenario pocket artifact ${entry.artikulId} did not reach the bag`);
      await deps.inventory.putOn(hero, stack.id, definition);
    });
  }
}
