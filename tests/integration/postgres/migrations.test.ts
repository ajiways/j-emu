import { sql } from "drizzle-orm";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { migrateDatabase } from "../../../src/infrastructure/postgres/migration-runner.ts";
import { artifacts, bots } from "../../../src/modules/catalog/infrastructure/schema.ts";
import { heroes } from "../../../src/modules/character/infrastructure/schema.ts";
import { events, fights, participants } from "../../../src/modules/combat/infrastructure/schema.ts";
import {
  activeRelease,
  bootstrapImports,
  draftVersions,
  drafts,
  releaseEntries,
  releases,
} from "../../../src/modules/content/infrastructure/schema.ts";
import { accounts, sessions } from "../../../src/modules/identity/infrastructure/schema.ts";
import { items } from "../../../src/modules/inventory/infrastructure/schema.ts";
import { areas, huntSpawns } from "../../../src/modules/world/infrastructure/schema.ts";
import { withIsolatedTestDatabase } from "../../support/postgres/isolated-test-database.ts";
import {
  requireTestDatabaseUrl,
  testDatabaseName,
} from "../../support/postgres/test-database-url.ts";

const databaseUrl = requireTestDatabaseUrl();
const drizzleFolder = path.resolve(process.cwd(), "drizzle");

describe("Drizzle migrations", () => {
  let database: PostgresDatabase;

  beforeAll(async () => {
    database = new PostgresDatabase(databaseUrl);
  });

  afterAll(async () => {
    await database.close();
  });

  it("creates only the live module schemas and tables", async () => {
    const schemas = await names(
      sql`SELECT schema_name AS name FROM information_schema.schemata
          WHERE schema_name IN ('identity','character','catalog','inventory','world','combat','content','quests','social','economy')`,
    );
    expect(schemas.sort()).toEqual([
      "catalog",
      "character",
      "combat",
      "content",
      "identity",
      "inventory",
      "world",
    ]);

    const tables = await names(
      sql`SELECT table_schema || '.' || table_name AS name
          FROM information_schema.tables
          WHERE table_schema IN ('identity','character','catalog','inventory','world','combat','content')
            AND table_type = 'BASE TABLE'`,
    );
    expect(tables.sort()).toEqual(
      [
        "catalog.artifacts",
        "catalog.bots",
        "character.heroes",
        "combat.events",
        "combat.fights",
        "combat.participants",
        "content.active_release",
        "content.bootstrap_imports",
        "content.draft_versions",
        "content.drafts",
        "content.release_entries",
        "content.releases",
        "identity.accounts",
        "identity.sessions",
        "inventory.items",
        "world.areas",
        "world.hunt_spawns",
      ].sort(),
    );
    expect([
      accounts,
      sessions,
      artifacts,
      bots,
      areas,
      huntSpawns,
      heroes,
      items,
      fights,
      participants,
      events,
      drafts,
      draftVersions,
      releases,
      releaseEntries,
      activeRelease,
      bootstrapImports,
    ]).toHaveLength(17);
  });

  it("applies database identifier defaults and bounded item sequence", async () => {
    const accountDefault = await names(
      sql`SELECT column_default AS name
          FROM information_schema.columns
          WHERE table_schema = 'identity' AND table_name = 'accounts' AND column_name = 'id'`,
    );
    expect(accountDefault[0]).toMatch(/gen_random_uuid\(\)/);
    const heroDefault = await names(
      sql`SELECT column_default AS name
          FROM information_schema.columns
          WHERE table_schema = 'character' AND table_name = 'heroes' AND column_name = 'id'`,
    );
    expect(heroDefault[0]).toMatch(/gen_random_uuid\(\)/);
    const itemDefault = await names(
      sql`SELECT column_default AS name
          FROM information_schema.columns
          WHERE table_schema = 'inventory' AND table_name = 'items' AND column_name = 'id'`,
    );
    expect(itemDefault[0]).toMatch(/nextval\('inventory\.item_id_seq'::regclass\)/);

    const itemSequence = await database.session().execute<{
      min_value: string;
      max_value: string;
      cycle: boolean;
    }>(
      sql`SELECT min_value::text AS min_value, max_value::text AS max_value, cycle
          FROM pg_sequences
          WHERE schemaname = 'inventory' AND sequencename = 'item_id_seq'`,
    );
    expect(itemSequence).toEqual([
      { min_value: "1000000000", max_value: "2147483647", cycle: false },
    ]);

    const combatCycles = await database.session().execute<{ cycle: boolean }>(
      sql`SELECT cycle FROM pg_sequences
          WHERE schemaname = 'combat' AND sequencename IN ('fight_id_seq', 'participant_id_seq')
          ORDER BY sequencename`,
    );
    expect([...combatCycles].map((row) => row.cycle)).toEqual([false, false]);
  });

  it("treats a second migrate as a no-op", async () => {
    const before = await appliedCount();
    await migrateDatabase(databaseUrl, drizzleFolder);
    await expect(appliedCount()).resolves.toBe(before);
  });

  it("detects a modified applied migration", async () => {
    const tampered = copyMigrations();
    const first = JSON.parse(fs.readFileSync(path.join(tampered, "meta/_journal.json"), "utf8"))
      .entries[0] as { tag: string };
    fs.appendFileSync(path.join(tampered, `${first.tag}.sql`), "\n-- tampered\n");
    await expect(migrateDatabase(databaseUrl, tampered)).rejects.toThrow(/was modified/);
    fs.rmSync(tampered, { recursive: true });
  });

  it("upgrades from an earlier baseline to the full journal", async () => {
    const journal = JSON.parse(
      fs.readFileSync(path.join(drizzleFolder, "meta/_journal.json"), "utf8"),
    ) as {
      entries: Array<{ tag: string }>;
    };
    const secondTag = journal.entries[1]?.tag;
    if (!secondTag) throw new Error("Expected at least two Drizzle migrations");
    const sourceName = testDatabaseName(databaseUrl).replace(/_test$/, "");
    await withIsolatedTestDatabase(`${sourceName}_upgrade_test`, async (isolatedUrl) => {
      const isolated = new PostgresDatabase(isolatedUrl);
      try {
        const partial = copyMigrations(secondTag);
        await migrateDatabase(isolatedUrl, partial);
        const afterPartial = await isolated.session().execute<{ name: string }>(
          sql`SELECT schema_name AS name FROM information_schema.schemata
              WHERE schema_name IN ('identity','catalog','world')`,
        );
        expect([...afterPartial].map((row) => row.name).sort()).toEqual(["catalog", "identity"]);
        await migrateDatabase(isolatedUrl, drizzleFolder);
        const afterFull = await isolated.session().execute<{ name: string }>(
          sql`SELECT schema_name AS name FROM information_schema.schemata
              WHERE schema_name IN ('identity','catalog','world','character','inventory','combat','content')`,
        );
        expect([...afterFull].map((row) => row.name).sort()).toEqual([
          "catalog",
          "character",
          "combat",
          "content",
          "identity",
          "inventory",
          "world",
        ]);
        fs.rmSync(partial, { recursive: true });
      } finally {
        await isolated.close();
      }
    });
  });

  async function names(query: ReturnType<typeof sql>): Promise<string[]> {
    const rows = await database.session().execute<{ name: string }>(query);
    return [...rows].map((row) => row.name);
  }

  async function appliedCount(): Promise<number> {
    const rows = await database
      .session()
      .execute<{ count: string }>(
        sql`SELECT count(*)::text AS count FROM drizzle.__drizzle_migrations`,
      );
    const count = Number(rows[0]?.count);
    if (!Number.isInteger(count)) throw new Error("Migration ledger count is missing");
    return count;
  }
});

function copyMigrations(throughTag?: string): string {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "j-emu-drizzle-"));
  const journal = JSON.parse(
    fs.readFileSync(path.join(drizzleFolder, "meta/_journal.json"), "utf8"),
  ) as {
    version: string;
    dialect: string;
    entries: Array<{ tag: string }>;
  };
  const entries = [];
  for (const entry of journal.entries) {
    entries.push(entry);
    if (throughTag && entry.tag === throughTag) break;
  }
  if (throughTag && entries.at(-1)?.tag !== throughTag) {
    throw new Error(`Unknown migration tag ${throughTag}`);
  }
  fs.mkdirSync(path.join(destination, "meta"), { recursive: true });
  fs.writeFileSync(
    path.join(destination, "meta/_journal.json"),
    JSON.stringify({ ...journal, entries }, null, 2),
  );
  for (const entry of entries) {
    fs.copyFileSync(
      path.join(drizzleFolder, `${entry.tag}.sql`),
      path.join(destination, `${entry.tag}.sql`),
    );
  }
  return destination;
}
