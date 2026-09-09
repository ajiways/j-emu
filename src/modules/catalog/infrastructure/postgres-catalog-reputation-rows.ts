import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { ReputationTrackDocument } from "../../content/domain/content-document.ts";
import { reputationTracks } from "./schema.ts";

export async function insertReputationTracks(
  session: ReturnType<PostgresDatabase["session"]>,
  releaseId: string,
  rows: readonly ReputationTrackDocument[],
): Promise<void> {
  if (rows.length === 0) throw new Error("Reputation tracks are missing");
  await session.insert(reputationTracks).values(
    rows.map((row) => ({
      releaseId,
      objectId: row.objectId,
      type: row.type,
      title: row.title,
      image: row.image,
      unlockFlag: row.unlockFlag,
    })),
  );
}
