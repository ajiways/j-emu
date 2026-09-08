import { and, eq, inArray } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { ActiveContentRevision } from "../../content/ports/active-content-revision.ts";
import { computeProgressionDigest } from "../../content/domain/progression-digest.ts";
import { isProgressionEvidenceKind } from "../../content/domain/progression-managed-skills.ts";
import { LevelBoundary } from "../domain/level-boundary.ts";
import {
  ProgressionSnapshot,
  type ProgressionLevel,
  type ProgressionManagedSkill,
} from "../domain/progression-snapshot.ts";
import type { CatalogProgression } from "../ports/catalog-progression.ts";
import { levelBoundaries, levelSkillValues } from "./schema.ts";

export class PostgresCatalogProgression implements CatalogProgression {
  constructor(
    private readonly database: PostgresDatabase,
    private readonly revision: ActiveContentRevision,
  ) {}

  async progressionSnapshot(): Promise<ProgressionSnapshot> {
    const releaseId = await this.revision.requireId();
    const boundaryRows = await this.database
      .session()
      .select()
      .from(levelBoundaries)
      .where(eq(levelBoundaries.releaseId, releaseId));
    if (boundaryRows.length < 1) throw new Error("Progression curve is missing");
    const skillRows = await this.database
      .session()
      .select()
      .from(levelSkillValues)
      .where(
        and(
          eq(levelSkillValues.releaseId, releaseId),
          inArray(
            levelSkillValues.level,
            boundaryRows.map((row) => row.level),
          ),
        ),
      );
    const skillsByLevel = new Map<number, ProgressionManagedSkill[]>();
    for (const row of skillRows) {
      const current = skillsByLevel.get(row.level);
      if (current) {
        current.push(managedSkillFromRow(row));
      } else {
        skillsByLevel.set(row.level, [managedSkillFromRow(row)]);
      }
    }
    const levels: ProgressionLevel[] = [...boundaryRows]
      .sort((left, right) => left.level - right.level)
      .map((row) => {
        const managedSkills = skillsByLevel.get(row.level);
        if (!managedSkills || managedSkills.length < 1) {
          throw new Error(`Progression managed skills for level ${row.level} are missing`);
        }
        return {
          boundary: new LevelBoundary(
            row.level,
            row.expMin,
            row.expMax,
            row.bagCnt,
            row.honorRank,
            row.honorMin,
            row.honorMax,
            row.honorStatus,
          ),
          managedSkills,
        };
      });
    return new ProgressionSnapshot(
      releaseId,
      computeProgressionDigest(
        levels.map((level) => ({
          level: level.boundary.level,
          expMin: level.boundary.expMin,
          expMax: level.boundary.expMax,
          bagCnt: level.boundary.bagCnt,
          skills: level.managedSkills,
        })),
      ),
      levels,
    );
  }
}

function managedSkillFromRow(row: {
  skillId: string;
  value: number;
  evidenceKind: string;
  sourceDigest: string;
}): ProgressionManagedSkill {
  if (!isProgressionEvidenceKind(row.evidenceKind)) {
    throw new Error(`Progression skill ${row.skillId} evidenceKind is invalid`);
  }
  return {
    id: row.skillId,
    value: row.value,
    evidenceKind: row.evidenceKind,
    sourceDigest: row.sourceDigest,
  };
}
