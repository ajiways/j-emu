import type { FinishedFightRecord } from "../../../src/modules/combat/domain/finished-fight-record.ts";
import type { FinishedFightStore } from "../../../src/modules/combat/ports/finished-fight-store.ts";

export class RecordingFinishedFightStore implements FinishedFightStore {
  readonly records: FinishedFightRecord[] = [];
  readonly deleted: Array<{ cutoff: Date; limit: number }> = [];

  async record(row: FinishedFightRecord): Promise<void> {
    if (this.records.some((existing) => existing.id === row.id)) return;
    this.records.push(row);
  }

  async findById(id: bigint): Promise<FinishedFightRecord | null> {
    return this.records.find((row) => row.id === id) ?? null;
  }

  async deleteExpiredBatch(cutoff: Date, limit: number): Promise<number> {
    this.deleted.push({ cutoff, limit });
    const expired = this.records.filter((row) => row.finishedAt.getTime() <= cutoff.getTime());
    const batch = expired.slice(0, limit);
    for (const row of batch) {
      const index = this.records.indexOf(row);
      if (index >= 0) this.records.splice(index, 1);
    }
    return batch.length;
  }
}
