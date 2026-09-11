import type { FarmStock } from "../domain/hero-assistant.ts";

export interface FarmStockRepository {
  listByAreaFarm(areaId: string, farmId: number): Promise<FarmStock[]>;
  save(row: FarmStock): Promise<void>;
}
