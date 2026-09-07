import type { Clock } from "../../../shared/kernel/clock.ts";
import { FINISHED_FIGHT_RETENTION_MS } from "../domain/finished-fight-retention.ts";
import type { FinishedFightStore } from "../ports/finished-fight-store.ts";

export class FinishedFightCleanup {
  constructor(
    private readonly store: FinishedFightStore,
    private readonly clock: Clock,
    private readonly batchSize: number,
  ) {
    if (!Number.isInteger(this.batchSize) || this.batchSize < 1) {
      throw new Error("Finished fight cleanup batch size must be a positive integer");
    }
  }

  async runBatch(): Promise<number> {
    const cutoff = new Date(this.clock.now().getTime() - FINISHED_FIGHT_RETENTION_MS);
    return this.store.deleteExpiredBatch(cutoff, this.batchSize);
  }
}
