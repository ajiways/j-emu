import { and, eq, inArray } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { ArtifactDefinition } from "../domain/artifact-definition.ts";
import type { ReleaseArtifacts } from "../ports/release-artifacts.ts";
import { artifactDefinitionFromRow } from "./artifact-definition-from-row.ts";
import { artifacts } from "./schema.ts";

export class PostgresReleaseArtifacts implements ReleaseArtifacts {
  constructor(private readonly database: PostgresDatabase) {}

  async definitionsFor(
    releaseId: string,
    artifactIds: readonly number[],
  ): Promise<readonly ArtifactDefinition[]> {
    if (!releaseId) throw new Error("Artifact release id is required");
    if (artifactIds.length === 0) return [];
    const uniqueIds = [...new Set(artifactIds)];
    const rows = await this.database
      .session()
      .select()
      .from(artifacts)
      .where(and(eq(artifacts.releaseId, releaseId), inArray(artifacts.id, uniqueIds)));
    if (rows.length !== uniqueIds.length) {
      const found = new Set(rows.map((row) => row.id));
      const missing = uniqueIds.filter((id) => !found.has(id));
      throw new Error(`Artifact catalog entry ${missing[0]} is missing from release ${releaseId}`);
    }
    return rows.map((row) => artifactDefinitionFromRow(row));
  }
}
