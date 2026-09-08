import type { LevelBoundary } from "./level-boundary.ts";
import type { ProgressionEvidenceKind } from "../../content/domain/progression-managed-skills.ts";
import { PROGRESSION_MANAGED_SKILL_IDS } from "../../content/domain/progression-managed-skills.ts";

export type ProgressionManagedSkill = Readonly<{
  id: string;
  value: number;
  evidenceKind: ProgressionEvidenceKind;
  sourceDigest: string;
}>;

export type ProgressionLevel = Readonly<{
  boundary: LevelBoundary;
  managedSkills: readonly ProgressionManagedSkill[];
}>;

export class ProgressionSnapshot {
  constructor(
    readonly contentReleaseId: string,
    readonly progressionDigest: string,
    readonly levels: readonly ProgressionLevel[],
  ) {
    if (!contentReleaseId) throw new Error("Progression snapshot release id is required");
    if (!progressionDigest) throw new Error("Progression digest is required");
    if (levels.length < 1) throw new Error("Progression snapshot has no levels");
    const seen = new Set<number>();
    for (const [index, level] of levels.entries()) {
      if (level.boundary.level !== index + 1) {
        throw new Error("Progression snapshot levels must be contiguous from 1");
      }
      if (seen.has(level.boundary.level)) {
        throw new Error(`Duplicate progression level ${level.boundary.level}`);
      }
      seen.add(level.boundary.level);
      requireManagedSet(level);
    }
  }

  requireLevel(level: number): ProgressionLevel {
    const match = this.levels.find((entry) => entry.boundary.level === level);
    if (!match) {
      throw new Error(`Progression level ${level} is missing from the published curve`);
    }
    return match;
  }

  boundaryForExp(exp: number): ProgressionLevel | null {
    if (!Number.isInteger(exp) || exp < 0) return null;
    return (
      this.levels.find((entry) => exp >= entry.boundary.expMin && exp < entry.boundary.expMax) ??
      null
    );
  }
}

function requireManagedSet(level: ProgressionLevel): void {
  const ids = new Set(level.managedSkills.map((skill) => skill.id));
  if (ids.size !== PROGRESSION_MANAGED_SKILL_IDS.length) {
    throw new Error(`Progression level ${level.boundary.level} managed skill set is invalid`);
  }
  for (const id of PROGRESSION_MANAGED_SKILL_IDS) {
    if (!ids.has(id)) {
      throw new Error(`Progression level ${level.boundary.level} is missing ${id}`);
    }
  }
}
