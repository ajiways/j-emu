import { honorRankCatalogFromConf } from "../domain/honor-progress.ts";
import type { HonorRankCatalog } from "../domain/honor-progress.ts";
import type { Catalog } from "../ports/catalog.ts";
import type { HonorRanks } from "../ports/honor-ranks.ts";

export class CatalogHonorRanks implements HonorRanks {
  constructor(private readonly catalog: Pick<Catalog, "commonConf">) {}

  async honorRankCatalog(): Promise<HonorRankCatalog> {
    return honorRankCatalogFromConf(await this.catalog.commonConf());
  }
}
