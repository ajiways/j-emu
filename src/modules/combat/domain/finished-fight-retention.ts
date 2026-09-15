/** Product retention for finished fight history. ADR-0020. */
export const FINISHED_FIGHT_RETENTION_MS = 72 * 60 * 60 * 1000;

/** Bounded DELETE batch keyed by indexed `finished_at`. */
export const FINISHED_FIGHT_CLEANUP_BATCH_SIZE = 100;

/** Periodic cleanup interval. Not used on finish/read request paths. */
export const FINISHED_FIGHT_CLEANUP_INTERVAL_MS = 60_000;

/** PageFight / `arena|finished_fights` page size from old `fightHistory.ts`. */
export const FINISHED_FIGHT_PAGE_SIZE = 10;
