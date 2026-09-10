import { and, eq, lte, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import type { InstanceBindRecord, InstanceCopyRecord } from "../domain/instance-copy.ts";
import type { InstanceRepository, NewInstanceCopy } from "../ports/instance-repository.ts";
import { binds, copies, killedSpawns } from "./schema.ts";

export class PostgresInstanceRepository implements InstanceRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async lockCopy(copyId: number): Promise<InstanceCopyRecord | null> {
    const rows = await this.database
      .session()
      .select()
      .from(copies)
      .where(eq(copies.id, copyId))
      .for("update");
    return this.oneCopy(rows, `copy ${copyId}`);
  }

  async getCopy(copyId: number): Promise<InstanceCopyRecord | null> {
    const rows = await this.database.session().select().from(copies).where(eq(copies.id, copyId));
    return this.oneCopy(rows, `copy ${copyId}`);
  }

  async insertCopy(values: NewInstanceCopy): Promise<InstanceCopyRecord> {
    const rows = await this.database
      .session()
      .insert(copies)
      .values({
        copyType: values.copyType,
        artikulId: values.artikulId,
        createdUnix: values.createdUnix,
        expiresUnix: values.expiresUnix,
        pendingKick: values.pendingKick,
      })
      .returning();
    const copy = this.oneCopy(rows, "inserted copy");
    if (!copy) throw new Error("Instance copy insert did not return a row");
    return copy;
  }

  async setPendingKick(copyId: number, pending: boolean): Promise<void> {
    const updated = await this.database
      .session()
      .update(copies)
      .set({ pendingKick: pending ? 1 : 0 })
      .where(eq(copies.id, copyId))
      .returning({ id: copies.id });
    if (updated.length !== 1) throw new Error(`Instance copy ${copyId} was not updated`);
  }

  async listExpired(nowUnix: number): Promise<readonly InstanceCopyRecord[]> {
    if (!Number.isInteger(nowUnix) || nowUnix < 1) {
      throw new Error("Expired copy list requires a positive unix timestamp");
    }
    const rows = await this.database
      .session()
      .select()
      .from(copies)
      .where(lte(copies.expiresUnix, nowUnix));
    return rows.map((row) => copyFromRow(row));
  }

  async getBind(heroId: number, dungeonArtikulId: string): Promise<InstanceBindRecord | null> {
    const rows = await this.database
      .session()
      .select()
      .from(binds)
      .where(and(eq(binds.heroId, heroId), eq(binds.dungeonArtikulId, dungeonArtikulId)));
    if (rows.length > 1) {
      throw new Error(`Multiple binds found for hero ${heroId} dungeon ${dungeonArtikulId}`);
    }
    const row = rows[0];
    if (!row) return null;
    return {
      heroId: row.heroId,
      dungeonArtikulId: row.dungeonArtikulId,
      copyId: row.copyId,
      boundUnix: row.boundUnix,
    };
  }

  async listBinds(heroId: number): Promise<readonly InstanceBindRecord[]> {
    if (!Number.isInteger(heroId) || heroId < 1) {
      throw new Error("Bind list requires a positive hero id");
    }
    const rows = await this.database.session().select().from(binds).where(eq(binds.heroId, heroId));
    return rows.map((row) => ({
      heroId: row.heroId,
      dungeonArtikulId: row.dungeonArtikulId,
      copyId: row.copyId,
      boundUnix: row.boundUnix,
    }));
  }

  async upsertBind(
    heroId: number,
    dungeonArtikulId: string,
    copyId: number,
    boundUnix: number,
  ): Promise<void> {
    await this.database
      .session()
      .insert(binds)
      .values({ heroId, dungeonArtikulId, copyId, boundUnix })
      .onConflictDoUpdate({
        target: [binds.heroId, binds.dungeonArtikulId],
        set: { copyId, boundUnix: sql`${binds.boundUnix}` },
      });
  }

  async killedSpawnKeys(copyId: number): Promise<readonly string[]> {
    const rows = await this.database
      .session()
      .select({ spawnKey: killedSpawns.spawnKey })
      .from(killedSpawns)
      .where(eq(killedSpawns.copyId, copyId));
    return rows.map((row) => row.spawnKey);
  }

  async markSpawnKilled(copyId: number, spawnKey: string): Promise<void> {
    if (!spawnKey) throw new Error("Killed spawn key is required");
    await this.database
      .session()
      .insert(killedSpawns)
      .values({ copyId, spawnKey })
      .onConflictDoNothing();
  }

  private oneCopy(
    rows: Array<{
      id: number;
      copyType: string;
      artikulId: string;
      createdUnix: number;
      expiresUnix: number;
      pendingKick: number;
    }>,
    key: string,
  ): InstanceCopyRecord | null {
    if (rows.length > 1) throw new Error(`Multiple rows found for ${key}`);
    const row = rows[0];
    if (!row) return null;
    return copyFromRow(row);
  }
}

function copyFromRow(row: {
  id: number;
  copyType: string;
  artikulId: string;
  createdUnix: number;
  expiresUnix: number;
  pendingKick: number;
}): InstanceCopyRecord {
  if (row.copyType !== "dungeon" && row.copyType !== "bg") {
    throw new Error(`Instance copy ${row.id} type ${row.copyType} is not dungeon or bg`);
  }
  if (row.pendingKick !== 0 && row.pendingKick !== 1) {
    throw new Error(`Instance copy ${row.id} pending_kick is invalid`);
  }
  return {
    id: row.id,
    copyType: row.copyType,
    artikulId: row.artikulId,
    createdUnix: row.createdUnix,
    expiresUnix: row.expiresUnix,
    pendingKick: row.pendingKick,
  };
}
