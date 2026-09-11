import type { HonorRankCatalog } from "../domain/honor-progress.ts";

export interface HonorRanks {
  honorRankCatalog(): Promise<HonorRankCatalog>;
}
