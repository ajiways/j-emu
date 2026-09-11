import {
  honorProgress,
  honorRankCatalogFromConf,
  type HonorProgress,
} from "../../catalog/domain/honor-progress.ts";
import type { Catalog } from "../../catalog/ports/catalog.ts";
import type { Hero } from "../../character/domain/hero.ts";

export async function liveHonorProgress(catalog: Catalog, hero: Hero): Promise<HonorProgress> {
  return honorProgress(
    honorRankCatalogFromConf(await catalog.commonConf()),
    hero.honor,
    hero.level,
  );
}
