import { eq } from "drizzle-orm";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { restoreFinishedFightRecord } from "../../../src/modules/combat/domain/finished-fight-record.ts";
import { finishedFights } from "../../../src/modules/combat/infrastructure/schema.ts";
import { requireTestDatabaseUrl } from "./test-database-url.ts";

export async function loadFinishedFightByWireId(fightId: string) {
  const database = new PostgresDatabase(requireTestDatabaseUrl());
  try {
    const rows = await database
      .session()
      .select()
      .from(finishedFights)
      .where(eq(finishedFights.id, BigInt(fightId)));
    if (rows.length > 1) throw new Error(`Multiple finished fights for ${fightId}`);
    const row = rows[0];
    return row ? restoreFinishedFightRecord(row) : null;
  } finally {
    await database.close();
  }
}
