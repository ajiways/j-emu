import { eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { FinishedFightConflictError } from "../domain/finished-fight-conflict-error.ts";
import {
  finishedFightOutcomesEqual,
  restoreFinishedFightRecord,
  type FinishedFightRecord,
} from "../domain/finished-fight-record.ts";
import { parseFinishedFightTeams } from "../domain/finished-fight-teams.ts";
import type { FinishedFightStore } from "../ports/finished-fight-store.ts";
import { finishedFights } from "./schema.ts";

export class PostgresFinishedFightStore implements FinishedFightStore {
  constructor(private readonly database: PostgresDatabase) {}

  async record(row: FinishedFightRecord): Promise<void> {
    const teams = parseFinishedFightTeams(row.teams);
    try {
      await this.database.session().insert(finishedFights).values({
        id: row.id,
        accountId: row.accountId,
        heroId: row.heroId,
        title: row.title,
        type: row.type,
        timeout: row.timeout,
        levelMin: row.levelMin,
        levelMax: row.levelMax,
        level: row.level,
        mlTitle: row.mlTitle,
        winner: row.winner,
        started: row.started,
        duration: row.duration,
        teams,
        areaId: row.areaId,
        finishedAt: row.finishedAt,
      });
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
      const existing = await this.findById(row.id);
      if (!existing) {
        throw new Error(`Finished fight ${row.id} reported a unique conflict but was not found`);
      }
      if (finishedFightOutcomesEqual(existing, row)) return;
      throw new FinishedFightConflictError(row.id);
    }
  }

  async findById(id: bigint): Promise<FinishedFightRecord | null> {
    const rows = await this.database
      .session()
      .select()
      .from(finishedFights)
      .where(eq(finishedFights.id, id));
    if (rows.length > 1) throw new Error(`Multiple finished fights found for id ${id}`);
    const row = rows[0];
    if (!row) return null;
    return restoreFinishedFightRecord(row);
  }

  async deleteExpiredBatch(cutoff: Date, limit: number): Promise<number> {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error("Finished fight cleanup limit must be a positive integer");
    }
    // Drizzle has no DELETE ... LIMIT. Bounded retention cleanup uses the
    // finished_at index and returns deleted ids for observability.
    // postgres.js does not bind Date through this sql template; pass ISO text.
    const deleted = await this.database.session().execute<{ id: string }>(sql`
      DELETE FROM combat.finished_fights
      WHERE id IN (
        SELECT id FROM combat.finished_fights
        WHERE finished_at <= ${cutoff.toISOString()}
        ORDER BY finished_at ASC
        LIMIT ${limit}
      )
      RETURNING id::text AS id
    `);
    return [...deleted].length;
  }
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "23505") return true;
  if ("cause" in error) return isUniqueViolation(error.cause);
  return false;
}
