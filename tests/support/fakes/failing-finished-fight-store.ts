import type { FinishedFightRecord } from "../../../src/modules/combat/domain/finished-fight-record.ts";
import type { FinishedFightStore } from "../../../src/modules/combat/ports/finished-fight-store.ts";

export class FailingFinishedFightStore implements FinishedFightStore {
  constructor(private readonly error: Error) {}

  async record(): Promise<void> {
    throw this.error;
  }

  async findById(): Promise<FinishedFightRecord | null> {
    throw this.error;
  }

  async deleteExpiredBatch(): Promise<number> {
    throw this.error;
  }
}
