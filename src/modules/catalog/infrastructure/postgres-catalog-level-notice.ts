import { and, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { LevelNotice } from "../domain/level-notice.ts";
import { levelBoundaries } from "./schema.ts";

export async function loadLevelNotice(
  database: PostgresDatabase,
  releaseId: string,
  level: number,
): Promise<LevelNotice | null> {
  const rows = await database
    .session()
    .select({ level: levelBoundaries.level, notice: levelBoundaries.notice })
    .from(levelBoundaries)
    .where(and(eq(levelBoundaries.releaseId, releaseId), eq(levelBoundaries.level, level)));
  if (rows.length > 1) throw new Error(`Multiple level boundaries found for ${level}`);
  const row = rows[0];
  if (!row) throw new Error(`Level catalog entry ${level} is missing`);
  if (row.notice === null) return null;
  return { level: row.level, ...row.notice };
}
