import type { HistoryWriteObserver } from "./history-write-observer.ts";

export class StructuredHistoryWriteObserver implements HistoryWriteObserver {
  constructor(private readonly emit: (event: Record<string, unknown>) => void) {}

  conflict(fightId: string, error: Error): void {
    this.emit({ event: "finished_fight_conflict", fightId, error: error.message });
  }

  failed(fightId: string, error: Error): void {
    this.emit({ event: "finished_fight_write_failed", fightId, error: error.message });
  }

  cleanupFailed(error: Error): void {
    this.emit({ event: "finished_fight_cleanup_failed", error: error.message });
  }
}
