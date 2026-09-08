import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { migrateDatabase } from "../../../src/infrastructure/postgres/migration-runner.ts";
import { PostgresHeroRepository } from "../../../src/modules/character/infrastructure/postgres-hero-repository.ts";
import { PostgresAccountRepository } from "../../../src/modules/identity/infrastructure/postgres-account-repository.ts";
import { playableNewHero } from "../../support/hero-fixtures.ts";
import { withIsolatedTestDatabase } from "../../support/postgres/isolated-test-database.ts";
import {
  requireTestDatabaseUrl,
  testDatabaseName,
} from "../../support/postgres/test-database-url.ts";

const databaseUrl = requireTestDatabaseUrl();

describe("HP regeneration migration", () => {
  it("backfills regen_at with unix-second truncated now", async () => {
    const sourceName = testDatabaseName(databaseUrl).replace(/_test$/, "");
    const migration = fs.readFileSync(
      path.resolve(process.cwd(), "drizzle/0006_character_hp_regeneration.sql"),
      "utf8",
    );
    expect(migration).toContain("date_trunc('second', now())");
    await withIsolatedTestDatabase(`${sourceName}_regenbf_test`, async (isolatedUrl) => {
      await migrateDatabase(isolatedUrl);
      const database = new PostgresDatabase(isolatedUrl);
      try {
        const account = await new PostgresAccountRepository(database).create(
          "regen-backfill",
          "RegenBf",
          null,
        );
        const hero = await new PostgresHeroRepository(database).create(
          playableNewHero(account.id, account.nick),
        );
        await database.session().execute(sql`
          ALTER TABLE character.heroes ALTER COLUMN regen_at DROP NOT NULL
        `);
        await database.session().execute(sql`
          UPDATE character.heroes SET regen_at = NULL WHERE id = ${hero.id}
        `);
        await database.session().execute(sql`
          UPDATE character.heroes
          SET regen_at = date_trunc('second', now())
          WHERE regen_at IS NULL
        `);
        await database.session().execute(sql`
          ALTER TABLE character.heroes ALTER COLUMN regen_at SET NOT NULL
        `);
        const rows = await database.session().execute<{ truncated: boolean }>(sql`
          SELECT regen_at = date_trunc('second', regen_at) AS truncated
          FROM character.heroes WHERE id = ${hero.id}
        `);
        expect(rows[0]?.truncated).toBe(true);
        const nullable = await database.session().execute<{ is_nullable: string }>(sql`
          SELECT is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'character' AND table_name = 'heroes' AND column_name = 'regen_at'
        `);
        expect(nullable[0]?.is_nullable).toBe("NO");
      } finally {
        await database.close();
      }
    });
  });
});
