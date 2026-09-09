import type { Catalog } from "../../catalog/ports/catalog.ts";
import { ARTIFACT_KIND_SET_BONUS } from "../../catalog/domain/artifact-kind.ts";
import type { InventoryRepository } from "../ports/inventory-repository.ts";

export async function purgeExpiredDrinks(
  inventory: InventoryRepository,
  catalog: Catalog,
  heroId: number,
  nowSec: number,
): Promise<boolean> {
  if (!Number.isInteger(nowSec) || nowSec < 1) {
    throw new Error("DRINK purge nowSec must be a positive unix timestamp");
  }
  const items = await inventory.lockForHero(heroId);
  let purged = false;
  for (const item of items) {
    if (item.location.kind !== "tempeffect") continue;
    if (item.expire <= 1) continue;
    if (item.expire > nowSec) continue;
    const definition = await catalog.artifact(item.artifactId);
    if (!definition) throw new Error(`Artifact catalog entry ${item.artifactId} is missing`);
    if (definition.kindId === ARTIFACT_KIND_SET_BONUS) continue;
    await inventory.delete(item);
    purged = true;
  }
  return purged;
}
