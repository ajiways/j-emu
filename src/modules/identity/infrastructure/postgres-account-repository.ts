import { eq, sql } from "drizzle-orm";
import type { PostgresDatabase } from "../../../infrastructure/postgres/database.ts";
import { Account } from "../domain/account.ts";
import { DuplicateAccountError } from "../domain/duplicate-account-error.ts";
import type { AccountRepository } from "../ports/account-repository.ts";
import { accounts } from "./schema.ts";

export class PostgresAccountRepository implements AccountRepository {
  constructor(private readonly database: PostgresDatabase) {}

  async findById(id: number): Promise<Account | null> {
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

  async findByNick(nick: string): Promise<Account | null> {
    const rows = await this.database
      .session()
      .select()
      .from(accounts)
      .where(eq(accounts.nick, nick));
    return this.single(rows, `account nick ${nick}`);
  }

  async create(login: string, nick: string, passwordHash: string | null): Promise<Account> {
    const credentials = Account.credentials(login, nick, passwordHash);
    try {
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
    } catch (error) {
      throw duplicateAccountError(error) ?? error;
    }
  }

  async save(account: Account): Promise<void> {
    const updated = await this.database
      .session()
      .update(accounts)
      .set({
        login: account.login,
        nick: account.nick,
        passwordHash: account.passwordHash,
      })
      .where(eq(accounts.id, account.id))
      .returning({ id: accounts.id });
    if (updated.length !== 1) {
      throw new Error(`Account ${account.id} was not updated`);
    }
  }

  private single(
    rows: Array<{ id: number; login: string; nick: string; passwordHash: string | null }>,
    key: string,
  ): Account | null {
    if (rows.length > 1) throw new Error(`Multiple rows found for ${key}`);
    const row = rows[0];
    return row ? Account.restore(row.id, row.login, row.nick, row.passwordHash) : null;
  }
}

function duplicateAccountError(error: unknown): DuplicateAccountError | undefined {
  if (!isUniqueViolation(error)) return undefined;
  const constraint = constraintName(error);
  if (constraint === "accounts_login_unique") return new DuplicateAccountError("login");
  if (constraint === "accounts_nick_unique") return new DuplicateAccountError("nick");
  return undefined;
}

function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ("code" in error && error.code === "23505") return true;
  if ("cause" in error) return isUniqueViolation(error.cause);
  return false;
}

function constraintName(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  if ("constraint_name" in error && typeof error.constraint_name === "string") {
    return error.constraint_name;
  }
  if ("constraint" in error && typeof error.constraint === "string") return error.constraint;
  if ("cause" in error) return constraintName(error.cause);
  return undefined;
}
