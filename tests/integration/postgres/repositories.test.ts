import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { PostgresAccountRepository } from "../../../src/modules/identity/infrastructure/postgres-account-repository.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";

const databaseUrl = requireTestDatabaseUrl();

describe("Postgres adapters", () => {
  let database: PostgresDatabase;

  beforeAll(async () => {
    database = new PostgresDatabase(databaseUrl);
  });

  afterAll(async () => {
    await database.close();
  });

  it("rolls back all repository writes in a failed Unit of Work", async () => {
    const accounts = new PostgresAccountRepository(database);
    let createdId: string | undefined;
    await expect(
      database.run(async () => {
        const account = await accounts.create(
          `rollback-${crypto.randomUUID()}`,
          `Rollback-${crypto.randomUUID()}`,
          null,
        );
        createdId = account.id;
        throw new Error("deliberate rollback");
      }),
    ).rejects.toThrow("deliberate rollback");
    if (!createdId) throw new Error("Account create did not return an id before rollback");
    await expect(accounts.findById(createdId)).resolves.toBeNull();
  });
});
