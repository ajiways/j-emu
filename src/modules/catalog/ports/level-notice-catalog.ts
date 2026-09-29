import type { LevelNotice } from "../domain/level-notice.ts";

export interface LevelNoticeCatalog {
  /** `null` only when the level has no authored notice; a missing level row is an error. */
  levelNotice(level: number): Promise<LevelNotice | null>;
}
