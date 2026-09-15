import type { FinishedFightRecord } from "../domain/finished-fight-record.ts";

export interface FinishedFightStore {
  record(row: FinishedFightRecord): Promise<void>;
  findById(id: bigint): Promise<FinishedFightRecord | null>;
  listByArea(areaId: string, cutoff: Date): Promise<readonly FinishedFightRecord[]>;
  deleteExpiredBatch(cutoff: Date, limit: number): Promise<number>;
}
