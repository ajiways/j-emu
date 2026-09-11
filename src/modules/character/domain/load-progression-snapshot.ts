import type { CatalogProgression } from "../../catalog/ports/catalog-progression.ts";
import type { ProgressionSnapshot } from "../../catalog/domain/progression-snapshot.ts";
import { ProgressionContentError } from "./progression-content-error.ts";

export async function loadProgressionSnapshot(
  progression: CatalogProgression,
): Promise<ProgressionSnapshot> {
  try {
    return await progression.progressionSnapshot();
  } catch (error) {
    throw new ProgressionContentError(
      error instanceof Error ? error.message : "Progression content is invalid",
    );
  }
}
