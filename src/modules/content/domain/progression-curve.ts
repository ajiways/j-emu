import {
  PROGRESSION_MANAGED_SKILL_IDS,
  isProgressionEvidenceKind,
  isProgressionManagedSkillId,
} from "./progression-managed-skills.ts";
import { computeProgressionDigest } from "./progression-digest.ts";
import type { LevelBoundaryDocument } from "./bootstrap-content.ts";

export function collectProgressionCurveIssues(
  levels: readonly LevelBoundaryDocument[],
  skillIds: ReadonlySet<string>,
): string[] {
  const issues: string[] = [];
  if (levels.length < 1) {
    issues.push("progression curve is missing");
    return issues;
  }
  const ordered = [...levels].sort((left, right) => left.level - right.level);
  if (ordered[0]?.level !== 1) issues.push("progression curve must start at level 1");
  if (ordered[0]?.expMin !== 0) issues.push("level 1 expMin must be 0");
  for (const [index, row] of ordered.entries()) {
    if (row.level !== index + 1) {
      issues.push(
        `progression levels must be contiguous; expected ${index + 1}, found ${row.level}`,
      );
    }
    const previous = ordered[index - 1];
    if (previous && previous.expMax !== row.expMin) {
      issues.push(`level ${previous.level} expMax must equal level ${row.level} expMin`);
    }
    if (!isProgressionEvidenceKind(row.evidenceKind)) {
      issues.push(`level ${row.level} evidenceKind is invalid`);
    }
    const managedIds = row.managedSkills.map((skill) => skill.id);
    if (managedIds.length !== PROGRESSION_MANAGED_SKILL_IDS.length) {
      issues.push(`level ${row.level} managed skill set is incomplete`);
    }
    const seen = new Set<string>();
    for (const skill of row.managedSkills) {
      if (!isProgressionManagedSkillId(skill.id)) {
        issues.push(`level ${row.level} has unknown managed skill ${skill.id}`);
      }
      if (!skillIds.has(skill.id)) {
        issues.push(
          `level ${row.level} managed skill ${skill.id} is missing from skill definitions`,
        );
      }
      if (seen.has(skill.id)) {
        issues.push(`level ${row.level} has duplicate managed skill ${skill.id}`);
      }
      seen.add(skill.id);
      if (!Number.isInteger(skill.value) || skill.value < 0) {
        issues.push(`level ${row.level} skill ${skill.id} value is invalid`);
      }
      if ((skill.id === "VIT" || skill.id === "MPMAX") && skill.value < 1) {
        issues.push(`level ${row.level} ${skill.id} must be positive`);
      }
    }
    for (const required of PROGRESSION_MANAGED_SKILL_IDS) {
      if (!seen.has(required)) {
        issues.push(`level ${row.level} is missing managed skill ${required}`);
      }
    }
  }
  const firstSet = canonicalManagedSet(ordered[0]);
  for (const row of ordered.slice(1)) {
    if (canonicalManagedSet(row) !== firstSet) {
      issues.push(`level ${row.level} managed skill set differs from level 1`);
    }
  }
  return issues;
}

export function progressionDigestFromLevels(levels: readonly LevelBoundaryDocument[]): string {
  return computeProgressionDigest(
    levels.map((level) => ({
      level: level.level,
      expMin: level.expMin,
      expMax: level.expMax,
      bagCnt: level.bagCnt,
      skills: level.managedSkills,
    })),
  );
}

export function managedSkillSourceDigest(level: LevelBoundaryDocument): string {
  return computeProgressionDigest([
    {
      level: level.level,
      expMin: level.expMin,
      expMax: level.expMax,
      bagCnt: level.bagCnt,
      skills: level.managedSkills,
    },
  ]);
}

function canonicalManagedSet(level: LevelBoundaryDocument | undefined): string {
  if (!level) return "";
  return [...level.managedSkills.map((skill) => skill.id)].sort().join(",");
}
