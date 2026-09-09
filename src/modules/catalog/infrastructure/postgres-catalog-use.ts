import { and, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { ArtifactBonus } from "../domain/artifact-bonus.ts";
import { UseScript, type UseScriptEffect, type UseScriptRequire } from "../domain/use-script.ts";
import { bonuses, useScripts } from "./schema.ts";

export async function loadBonus(
  database: PostgresDatabase,
  releaseId: string,
  id: number,
): Promise<ArtifactBonus | null> {
  const rows = await database
    .session()
    .select()
    .from(bonuses)
    .where(and(eq(bonuses.releaseId, releaseId), eq(bonuses.id, id)));
  if (rows.length > 1) throw new Error(`Multiple bonus definitions found for ${id}`);
  const row = rows[0];
  if (!row) return null;
  if (row.kind !== "skill") throw new Error(`Bonus ${id} kind must be skill`);
  return new ArtifactBonus(
    row.id,
    "skill",
    row.skillId,
    row.delta,
    row.needValue,
    row.artikulId,
    row.title,
    row.chatMsg,
  );
}

export async function loadUseScript(
  database: PostgresDatabase,
  releaseId: string,
  bonusId: number,
): Promise<UseScript | null> {
  const rows = await database
    .session()
    .select()
    .from(useScripts)
    .where(and(eq(useScripts.releaseId, releaseId), eq(useScripts.bonusId, bonusId)));
  if (rows.length > 1) throw new Error(`Multiple use scripts found for ${bonusId}`);
  const row = rows[0];
  if (!row) return null;
  return new UseScript(
    row.bonusId,
    requireRows(bonusId, row.require),
    typeof row.failPlaque === "string"
      ? row.failPlaque
      : fail(`Use script ${bonusId} failPlaque is required`),
    effectRows(bonusId, row.effects),
  );
}

function requireRows(bonusId: number, value: unknown): readonly UseScriptRequire[] {
  if (!Array.isArray(value)) throw new Error(`Use script ${bonusId} require must be an array`);
  return value.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`Use script ${bonusId} require[${index}] is invalid`);
    }
    const record = row as Record<string, unknown>;
    if (typeof record.artikulId !== "number" || typeof record.count !== "number") {
      throw new Error(`Use script ${bonusId} require[${index}] artikulId/count are required`);
    }
    return { artikulId: record.artikulId, count: record.count };
  });
}

function effectRows(bonusId: number, value: unknown): readonly UseScriptEffect[] {
  if (!Array.isArray(value)) throw new Error(`Use script ${bonusId} effects must be an array`);
  return value.map((row, index) => {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      throw new Error(`Use script ${bonusId} effects[${index}] is invalid`);
    }
    const record = row as Record<string, unknown>;
    if (record.type === "consume" || record.type === "grant") {
      if (typeof record.artikulId !== "number" || typeof record.count !== "number") {
        throw new Error(`Use script ${bonusId} ${record.type} artikulId/count are required`);
      }
      return { type: record.type, artikulId: record.artikulId, count: record.count };
    }
    if (record.type === "openDialog") {
      if (typeof record.dialogKey !== "string" || typeof record.npcId !== "number") {
        throw new Error(`Use script ${bonusId} openDialog dialogKey/npcId are required`);
      }
      return { type: "openDialog", dialogKey: record.dialogKey, npcId: record.npcId };
    }
    throw new Error(`Use script ${bonusId} effects[${index}] type is not supported`);
  });
}

function fail(message: string): never {
  throw new Error(message);
}
