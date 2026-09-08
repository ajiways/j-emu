import type { ValidatedContentBundle } from "../domain/content-document.ts";
import { progressionDigestFromLevels } from "../domain/progression-curve.ts";
import type { CatalogCompatibilitySnapshot } from "../../catalog/ports/catalog-compatibility.ts";
import { ContentValidationError } from "./content-validation-error.ts";

export class ContentActivationCompatibility {
  assertCompatible(
    previous: CatalogCompatibilitySnapshot,
    candidate: ValidatedContentBundle,
  ): void {
    const issues: string[] = [];
    const nextDigest = progressionDigestFromLevels(candidate.levels);
    if (nextDigest !== previous.progressionDigest) {
      issues.push("progression digest differs from the active release");
    }
    const nextArtifacts = new Map(
      candidate.artifacts.map((artifact) => [
        artifact.id,
        fingerprint(
          artifact.skills.map((skill) => ({
            id: skill.id,
            value: skill.value,
            flags: skill.flags,
          })),
        ),
      ]),
    );
    for (const artifact of previous.artifacts) {
      const next = nextArtifacts.get(artifact.id);
      if (next === undefined) {
        issues.push(`artifact ${artifact.id} was removed`);
        continue;
      }
      if (next !== fingerprint(artifact.skills)) {
        issues.push(`artifact ${artifact.id} stat skills changed`);
      }
    }
    if (issues.length > 0) throw new ContentValidationError(issues);
  }
}

function fingerprint(
  skills: readonly Readonly<{ id: string; value: number; flags: number }>[],
): string {
  return JSON.stringify(
    [...skills]
      .map((skill) => ({ id: skill.id, value: skill.value, flags: skill.flags }))
      .sort((left, right) => left.id.localeCompare(right.id)),
  );
}
