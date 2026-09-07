import { AsyncLocalStorage } from "node:async_hooks";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import type { UnitOfWork } from "../../shared/kernel/unit-of-work.ts";

export type DatabaseSession = PostgresJsDatabase;

export class PostgresDatabase implements UnitOfWork {
  private readonly client: postgres.Sql;
  private readonly db: DatabaseSession;
  private readonly transaction = new AsyncLocalStorage<DatabaseSession>();

  constructor(databaseUrl: string) {
    if (!databaseUrl) throw new Error("Postgres database URL is required");
    this.client = postgres(databaseUrl);
    this.db = drizzle(this.client);
  }

  session(): DatabaseSession {
    return this.transaction.getStore() ?? this.db;
  }

  async run<T>(work: () => Promise<T>): Promise<T> {
    const active = this.transaction.getStore();
    if (active) return work();
    return this.db.transaction((tx) => this.transaction.run(tx as DatabaseSession, work));
  }

  async close(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}
