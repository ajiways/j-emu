import { and, asc, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { ProfessionDefinition } from "../domain/profession-definition.ts";
import { professions } from "./schema-professions.ts";

export async function loadProfessions(
  database: PostgresDatabase,
  releaseId: string,
): Promise<readonly ProfessionDefinition[]> {
  const rows = await database
    .session()
    .select()
    .from(professions)
    .where(eq(professions.releaseId, releaseId))
    .orderBy(asc(professions.id));
  return rows.map(toProfession);
}

export async function loadProfession(
  database: PostgresDatabase,
  releaseId: string,
  id: number,
): Promise<ProfessionDefinition | null> {
  if (!Number.isInteger(id) || id < 1) throw new Error("Profession id is required");
  const rows = await database
    .session()
    .select()
    .from(professions)
    .where(and(eq(professions.releaseId, releaseId), eq(professions.id, id)));
  if (rows.length > 1) throw new Error(`Multiple professions found for ${id}`);
  const row = rows[0];
  return row ? toProfession(row) : null;
}

function toProfession(row: {
  id: number;
  title: string;
  type: number;
  skillId: string;
  picture: string;
  position: number;
  skillStepOverride: number | null;
  skillMinlvlOverride: number | null;
  description: string;
  infoUrl: string;
  userStatId: number | null;
}): ProfessionDefinition {
  if (row.type !== 1 && row.type !== 2) {
    throw new Error(`Profession ${row.id} type must be 1 or 2`);
  }
  return {
    id: row.id,
    title: row.title,
    type: row.type,
    skillId: row.skillId,
    picture: row.picture,
    position: row.position,
    skillStepOverride: row.skillStepOverride,
    skillMinlvlOverride: row.skillMinlvlOverride,
    description: row.description,
    infoUrl: row.infoUrl,
    userStatId: row.userStatId,
  };
}
