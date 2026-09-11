import { and, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { FarmStock } from "../domain/hero-assistant.ts";
import type { FarmStockRepository } from "../ports/farm-stock-repository.ts";
import { farmStocks } from "./schema.ts";

export class PostgresFarmStockRepository implements FarmStockRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async listByAreaFarm(areaId: string, farmId: number): Promise<FarmStock[]> {
    const rows = await this.database
      .session()
      .select()
      .from(farmStocks)
      .where(and(eq(farmStocks.areaId, areaId), eq(farmStocks.farmId, farmId)));
    return rows.map((row) => ({
      areaId: row.areaId,
      huntSpotId: row.huntSpotId,
      farmId: row.farmId,
      cntCurrent: row.cntCurrent,
      lastRespawnTime: row.lastRespawnTime,
      nextRespawnTime: row.nextRespawnTime,
    }));
  }

  async save(row: FarmStock): Promise<void> {
    await this.database
      .session()
      .update(farmStocks)
      .set({
        cntCurrent: row.cntCurrent,
        lastRespawnTime: row.lastRespawnTime,
        nextRespawnTime: row.nextRespawnTime,
      })
      .where(and(eq(farmStocks.areaId, row.areaId), eq(farmStocks.huntSpotId, row.huntSpotId)));
  }
}
