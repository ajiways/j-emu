export interface HistoryWriteObserver {
  conflict(fightId: string, error: Error): void;
  failed(fightId: string, error: Error): void;
  cleanupFailed(error: Error): void;
}
