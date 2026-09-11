import type { AreaFarmDocument } from "../../content/domain/content-farm.ts";

export interface FarmStockProjection {
  materialize(spots: readonly AreaFarmDocument[]): Promise<void>;
}
