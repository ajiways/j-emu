import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { AreaFarmDocument } from "../../content/domain/content-farm.ts";
import type { FarmStockProjection } from "../ports/farm-stock-projection.ts";
import { farmStocks } from "./schema.ts";

export class PostgresFarmStockProjection implements FarmStockProjection {
  constructor(private readonly database: PostgresDatabase) {}

  async materialize(spots: readonly AreaFarmDocument[]): Promise<void> {
    if (spots.length === 0) throw new Error("Area farms are missing");
    await this.database
      .session()
      .insert(farmStocks)
      .values(
        spots.map((spot) => ({
          areaId: spot.areaId,
          huntSpotId: spot.huntSpotId,
          farmId: spot.farmId,
          cntCurrent: spot.cntCurrent,
          lastRespawnTime: 0,
          nextRespawnTime: 0,
        })),
      )
      .onConflictDoNothing();
  }
}
