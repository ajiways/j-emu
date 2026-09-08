import { asc, eq } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { Session } from "../domain/session.ts";
import type { SessionRepository } from "../ports/session-repository.ts";
import { sessions } from "./schema.ts";

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async findById(id: string): Promise<Session | null> {
    const rows = await this.database.session().select().from(sessions).where(eq(sessions.id, id));
    if (rows.length > 1) throw new Error(`Multiple sessions found for id ${id}`);
    const row = rows[0];
    return row ? Session.restore(row.id, row.accountId, row.sessionKey, row.createdAt) : null;
  }

  async findByAccountId(accountId: number): Promise<Session | null> {
    const rows = await this.database
      .session()
      .select()
      .from(sessions)
      .where(eq(sessions.accountId, accountId));
    if (rows.length > 1) throw new Error(`Multiple sessions found for account ${accountId}`);
    const row = rows[0];
    return row ? Session.restore(row.id, row.accountId, row.sessionKey, row.createdAt) : null;
  }

  async listAccountIds(): Promise<readonly number[]> {
    const rows = await this.database
      .session()
      .select({ accountId: sessions.accountId })
      .from(sessions)
      .orderBy(asc(sessions.accountId));
    return rows.map((row) => row.accountId);
  }

  async replaceForAccount(session: Session): Promise<void> {
    const db = this.database.session();
    await db.delete(sessions).where(eq(sessions.accountId, session.accountId));
    await db.insert(sessions).values({
      id: session.id,
      accountId: session.accountId,
      sessionKey: session.sessionKey,
      createdAt: session.createdAt,
    });
  }

  async removeForAccount(accountId: number): Promise<void> {
    await this.database.session().delete(sessions).where(eq(sessions.accountId, accountId));
  }
}
