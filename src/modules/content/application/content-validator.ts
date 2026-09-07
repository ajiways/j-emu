import { digestCanonical } from "../domain/canonical-digest.ts";
import {
  CONTENT_VALIDATOR_VERSION,
  PLAYABLE_SLICE_SCHEMA_VERSION,
  type ContentBundle,
  type ContentEntry,
  type ValidatedContentBundle,
} from "../domain/content-document.ts";
import { ContentValidationError } from "./content-validation-error.ts";

export class ContentValidator {
  validate(bundle: ContentBundle): ValidatedContentBundle {
    const issues: string[] = [];
    if (bundle.schemaVersion !== PLAYABLE_SLICE_SCHEMA_VERSION) {
      issues.push(`unsupported schema version ${bundle.schemaVersion}`);
    }
    collectDuplicateIds(
      issues,
      "artifact",
      bundle.artifacts.map((artifact) => String(artifact.id)),
    );
    collectDuplicateIds(
      issues,
      "bot",
      bundle.bots.map((bot) => String(bot.id)),
    );
    collectDuplicateIds(
      issues,
      "area",
      bundle.areas.map((area) => area.id),
    );
    collectDuplicateIds(
      issues,
      "hunt_spawn",
      bundle.huntSpawns.map((spawn) => spawn.id),
    );
    const areaIds = new Set(bundle.areas.map((area) => area.id));
    const botIds = new Set(bundle.bots.map((bot) => bot.id));
    for (const spawn of bundle.huntSpawns) {
      if (!areaIds.has(spawn.areaId)) {
        issues.push(`hunt_spawn ${spawn.id} references missing area ${spawn.areaId}`);
      }
      if (!botIds.has(spawn.botId)) {
        issues.push(`hunt_spawn ${spawn.id} references missing bot ${spawn.botId}`);
      }
    }
    if (issues.length > 0) throw new ContentValidationError(issues);

    const entries: ContentEntry[] = [
      ...bundle.artifacts.map((document) => entry("artifact", String(document.id), document)),
      ...bundle.bots.map((document) => entry("bot", String(document.id), document)),
      ...bundle.areas.map((document) => entry("area", document.id, document)),
      ...bundle.huntSpawns.map((document) => entry("hunt_spawn", document.id, document)),
    ].sort((left, right) => {
      const typeOrder = left.type.localeCompare(right.type);
      return typeOrder !== 0 ? typeOrder : left.key.localeCompare(right.key);
    });
    return {
      schemaVersion: PLAYABLE_SLICE_SCHEMA_VERSION,
      validatorVersion: CONTENT_VALIDATOR_VERSION,
      checksum: digestCanonical({
        schemaVersion: PLAYABLE_SLICE_SCHEMA_VERSION,
        validatorVersion: CONTENT_VALIDATOR_VERSION,
        entries: entries.map((item) => ({
          type: item.type,
          key: item.key,
          digest: item.digest,
        })),
      }),
      artifacts: bundle.artifacts,
      bots: bundle.bots,
      areas: bundle.areas,
      huntSpawns: bundle.huntSpawns,
      entries,
    };
  }
}

function entry(
  type: ContentEntry["type"],
  key: string,
  document: ContentEntry["document"],
): ContentEntry {
  return { type, key, digest: digestCanonical(document), document };
}

function collectDuplicateIds(issues: string[], type: string, keys: readonly string[]): void {
  const seen = new Set<string>();
  for (const key of keys) {
    if (seen.has(key)) issues.push(`duplicate ${type} id ${key}`);
    seen.add(key);
  }
}
