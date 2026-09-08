import { eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { computeProgressionDigest } from "../../content/domain/progression-digest.ts";
import { artifactSkillsFromJson } from "./artifact-skills-from-json.ts";
import type {
  ArtifactSkillFingerprint,
  CatalogCompatibility,
  CatalogCompatibilitySnapshot,
} from "../ports/catalog-compatibility.ts";
import { artifacts, levelBoundaries, levelSkillValues } from "./schema.ts";

export class PostgresCatalogCompatibility implements CatalogCompatibility {
  constructor(private readonly database: PostgresDatabase) {}

  async compatibilitySnapshot(releaseId: string): Promise<CatalogCompatibilitySnapshot> {
    if (!releaseId) throw new Error("Compatibility snapshot release id is required");
    const [boundaryRows, skillRows, artifactRows] = await Promise.all([
      this.database
        .session()
        .select()
        .from(levelBoundaries)
        .where(eq(levelBoundaries.releaseId, releaseId)),
      this.database
        .session()
        .select()
        .from(levelSkillValues)
        .where(eq(levelSkillValues.releaseId, releaseId)),
      this.database.session().select().from(artifacts).where(eq(artifacts.releaseId, releaseId)),
    ]);
    const skillsByLevel = new Map<number, Array<{ id: string; value: number }>>();
    for (const row of skillRows) {
      const current = skillsByLevel.get(row.level);
      if (current) {
        current.push({ id: row.skillId, value: row.value });
      } else {
        skillsByLevel.set(row.level, [{ id: row.skillId, value: row.value }]);
      }
    }
    const fingerprints: ArtifactSkillFingerprint[] = artifactRows.map((row) => ({
      id: row.id,
      skills: artifactSkillsFromJson(row.id, row.skills).map((skill) => ({
        id: skill.id,
        value: skill.value,
        flags: skill.flags,
      })),
    }));
    fingerprints.sort((left, right) => left.id - right.id);
    return {
      progressionDigest: computeProgressionDigest(
        boundaryRows.map((row) => {
          const skills = skillsByLevel.get(row.level);
          if (!skills || skills.length < 1) {
            throw new Error(`Progression managed skills for level ${row.level} are missing`);
          }
          return {
            level: row.level,
            expMin: row.expMin,
            expMax: row.expMax,
            bagCnt: row.bagCnt,
            skills,
          };
        }),
      ),
      artifacts: fingerprints,
    };
  }
}
