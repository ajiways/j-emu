import type { FinishedFightRecord } from "../domain/finished-fight-record.ts";

export interface FinishedFightStore {
  record(row: FinishedFightRecord): Promise<void>;
  findById(id: bigint): Promise<FinishedFightRecord | null>;
  deleteExpiredBatch(cutoff: Date, limit: number): Promise<number>;
}
