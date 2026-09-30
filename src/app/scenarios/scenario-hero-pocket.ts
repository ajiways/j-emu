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
): Promise<string> {
  for (const entry of entries) {
    await deps.unitOfWork.run(async () => {
      const inPocket = (await deps.inventory.list(hero.id))
        .filter((item) => item.artifactId === entry.artikulId && item.location.kind === "pocket")
        .reduce((sum, item) => sum + item.quantity, 0);
      const missing = entry.count - inPocket;
      if (missing <= 0) return;
      const definition = await deps.catalog.artifact(entry.artikulId);
      if (!definition) throw new Error(`Scenario pocket artifact ${entry.artikulId} is missing`);
      const inBag = bagCount(await deps.inventory.list(hero.id), entry.artikulId);
      if (inBag < missing) {
        await deps.inventory.grantToBag({
          characterId: hero.id,
          artifactId: entry.artikulId,
          quantity: missing - inBag,
        });
      }
      // A put-on moves one unit into the pocket, so one call per missing unit.
      for (let unit = 0; unit < missing; unit += 1) {
        const stack = (await deps.inventory.list(hero.id)).find(
          (item) => item.artifactId === entry.artikulId && item.location.kind === "bag",
        );
        if (!stack)
          throw new Error(`Scenario pocket artifact ${entry.artikulId} ran out in the bag`);
        await deps.inventory.putOn(hero, stack.id, definition);
      }
    });
  }
  return pocketSummary(await deps.inventory.list(hero.id), deps.catalog);
}

/** What the hero carries in the pocket now, cell by cell, for the chat line that starts the fight. */
async function pocketSummary(
  items: Awaited<ReturnType<InventoryService["list"]>>,
  catalog: Catalog,
): Promise<string> {
  const cells = items
    .flatMap((item) =>
      item.location.kind === "pocket" ? [{ item, cell: item.location.position }] : [],
    )
    .sort((left, right) => left.cell - right.cell);
  const parts: string[] = [];
  for (const { item, cell } of cells) {
    const title = (await catalog.artifact(item.artifactId))?.title ?? String(item.artifactId);
    parts.push(`${cell}: ${title} ×${item.quantity}`);
  }
  return parts.length === 0 ? "карман пуст" : parts.join(", ");
}

function bagCount(items: Awaited<ReturnType<InventoryService["list"]>>, artikulId: number): number {
  return items
    .filter((item) => item.artifactId === artikulId && item.location.kind === "bag")
    .reduce((sum, item) => sum + item.quantity, 0);
}
