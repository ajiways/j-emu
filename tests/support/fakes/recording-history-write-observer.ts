import type { HistoryWriteObserver } from "../../../src/modules/combat/application/history-write-observer.ts";

export class RecordingHistoryWriteObserver implements HistoryWriteObserver {
  readonly events: Array<{ kind: string; fightId?: string; error: string }> = [];

  conflict(fightId: string, error: Error): void {
    this.events.push({ kind: "conflict", fightId, error: error.message });
  }

  failed(fightId: string, error: Error): void {
    this.events.push({ kind: "failed", fightId, error: error.message });
  }

  cleanupFailed(error: Error): void {
    this.events.push({ kind: "cleanup-failed", error: error.message });
  }
}
