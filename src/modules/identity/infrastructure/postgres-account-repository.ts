import { eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { Account } from "../domain/account.ts";
import type { AccountRepository } from "../ports/account-repository.ts";
import { accounts } from "./schema.ts";

export class PostgresAccountRepository implements AccountRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async findById(id: string): Promise<Account | null> {
    const rows = await this.database.session().select().from(accounts).where(eq(accounts.id, id));
    return this.single(rows, `account id ${id}`);
  }

  async findByLogin(login: string): Promise<Account | null> {
    const rows = await this.database
      .session()
      .select()
      .from(accounts)
      .where(eq(accounts.login, login));
    return this.single(rows, `account login ${login}`);
  }

  async create(login: string, nick: string, passwordHash: string | null): Promise<Account> {
    const credentials = Account.credentials(login, nick, passwordHash);
    const rows = await this.database
      .session()
      .insert(accounts)
      .values({
        login: credentials.login,
        nick: credentials.nick,
        passwordHash: credentials.passwordHash,
        createdAt: sql`now()`,
      })
      .returning();
    const row = rows[0];
    if (rows.length !== 1 || !row) throw new Error("Account insert did not return an id");
    return Account.restore(row.id, row.login, row.nick, row.passwordHash);
  }

  async save(account: Account): Promise<void> {
    await this.database
      .session()
      .insert(accounts)
      .values({
        id: account.id,
        login: account.login,
        nick: account.nick,
        passwordHash: account.passwordHash,
        createdAt: sql`now()`,
      })
      .onConflictDoUpdate({
        target: accounts.id,
        set: {
          login: account.login,
          nick: account.nick,
          passwordHash: account.passwordHash,
        },
      });
  }

  private single(
    rows: Array<{ id: string; login: string; nick: string; passwordHash: string | null }>,
    key: string,
  ): Account | null {
    if (rows.length > 1) throw new Error(`Multiple rows found for ${key}`);
    const row = rows[0];
    return row ? Account.restore(row.id, row.login, row.nick, row.passwordHash) : null;
  }
}
