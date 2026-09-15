import { and, asc, eq, ilike, inArray, or } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { ArtifactBrief, ArtifactSearchQuery } from "../domain/artifact-brief.ts";
import { artifacts } from "./schema.ts";

const briefColumns = {
  id: artifacts.id,
  title: artifacts.title,
  picture: artifacts.picture,
  kindId: artifacts.kindId,
  typeId: artifacts.typeId,
};

export async function searchArtifactBriefs(
  database: PostgresDatabase,
  releaseId: string,
  query: ArtifactSearchQuery,
): Promise<readonly ArtifactBrief[]> {
  if (query.ids !== undefined) {
    if (query.ids.length === 0) return [];
    const rows = await database
      .session()
      .select(briefColumns)
      .from(artifacts)
      .where(and(eq(artifacts.releaseId, releaseId), inArray(artifacts.id, [...query.ids])));
    const byId = new Map(rows.map((row) => [row.id, row]));
    const ordered: ArtifactBrief[] = [];
    for (const id of query.ids) {
      const row = byId.get(id);
      if (row) ordered.push(row);
    }
    return ordered;
  }
  const release = eq(artifacts.releaseId, releaseId);
  const match = titleOrIdMatch(query.text);
  const rows = await database
    .session()
    .select(briefColumns)
    .from(artifacts)
    .where(match ? and(release, match) : release)
    .orderBy(asc(artifacts.id))
    .limit(query.limit);
  return rows;
}

function titleOrIdMatch(text: string) {
  const trimmed = text.trim();
  if (trimmed === "") return undefined;
  const titleMatch = ilike(artifacts.title, `%${escapeLike(trimmed)}%`);
  if (!/^[1-9]\d*$/.test(trimmed)) return titleMatch;
  return or(eq(artifacts.id, Number(trimmed)), titleMatch);
}

function escapeLike(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("%", "\\%").replaceAll("_", "\\_");
}
