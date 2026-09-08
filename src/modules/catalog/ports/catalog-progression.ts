import type { ProgressionSnapshot } from "../domain/progression-snapshot.ts";

export interface CatalogProgression {
  progressionSnapshot(): Promise<ProgressionSnapshot>;
}
