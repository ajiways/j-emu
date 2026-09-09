import { and, asc, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { ReputationTrack } from "../domain/reputation-track.ts";
import { reputationTracks } from "./schema.ts";

export async function loadReputationTracks(
  database: PostgresDatabase,
  releaseId: string,
): Promise<readonly ReputationTrack[]> {
  const rows = await database
    .session()
    .select()
    .from(reputationTracks)
    .where(eq(reputationTracks.releaseId, releaseId))
    .orderBy(asc(reputationTracks.objectId));
  return rows.map(toTrack);
}

export async function loadReputationTrack(
  database: PostgresDatabase,
  releaseId: string,
  objectId: number,
): Promise<ReputationTrack | null> {
  if (!Number.isInteger(objectId) || objectId < 1) {
    throw new Error("Reputation object id is required");
  }
  const rows = await database
    .session()
    .select()
    .from(reputationTracks)
    .where(and(eq(reputationTracks.releaseId, releaseId), eq(reputationTracks.objectId, objectId)));
  if (rows.length > 1) throw new Error(`Multiple reputation tracks found for ${objectId}`);
  const row = rows[0];
  return row ? toTrack(row) : null;
}

function toTrack(row: {
  objectId: number;
  type: number;
  title: string;
  image: string;
  unlockFlag: string;
}): ReputationTrack {
  if (row.type !== 2) throw new Error(`Reputation track ${row.objectId} type must be 2`);
  return {
    objectId: row.objectId,
    type: 2,
    title: row.title,
    image: row.image,
    unlockFlag: row.unlockFlag,
  };
}
