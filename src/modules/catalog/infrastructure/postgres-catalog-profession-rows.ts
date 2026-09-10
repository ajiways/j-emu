import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { ProfessionDocument } from "../../content/domain/content-profession.ts";
import { professions } from "./schema-professions.ts";

export async function insertProfessions(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly ProfessionDocument[],
): Promise<void> {
  if (rows.length === 0) throw new Error("Professions are missing");
  await session.insert(professions).values(
    rows.map((row) => ({
      releaseId,
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
    })),
  );
}
