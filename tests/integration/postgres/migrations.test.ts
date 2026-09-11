import { sql } from "drizzle-orm";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { PostgresDatabase } from "../../../src/infrastructure/postgres/database.ts";
import { migrateDatabase } from "../../../src/infrastructure/postgres/migration-runner.ts";
import {
  appearancePresets,
  artifacts,
  bonuses,
  botLootEntries,
  bots,
  gameWideDocuments,
  levelBoundaries,
  levelSkillValues,
  skillDefinitions,
  storeLots,
  storeTypes,
  useScripts,
  reputationTracks,
} from "../../../src/modules/catalog/infrastructure/schema.ts";
import {
  botSpellBookSpells,
  botSpellBooks,
} from "../../../src/modules/catalog/infrastructure/schema-bot-spell-book.ts";
import {
  dungeonAreas,
  dungeonSpawnEncounters,
  dungeonSpawnRoutes,
  dungeonSpawnZones,
  dungeonSpawns,
  dungeons,
} from "../../../src/modules/catalog/infrastructure/schema-dungeons.ts";
import {
  battlegroundLeaderGroups,
  battlegroundRooms,
  battlegrounds,
} from "../../../src/modules/catalog/infrastructure/schema-battlegrounds.ts";
import { professions } from "../../../src/modules/catalog/infrastructure/schema-professions.ts";
import { craftRecipes } from "../../../src/modules/catalog/infrastructure/schema-crafts.ts";
import {
  areaFarms,
  assistantTypes,
  farmResources,
} from "../../../src/modules/catalog/infrastructure/schema-farms.ts";
import {
  farmStocks,
  heroAssistants,
  heroFarmStats,
  heroRecipes,
} from "../../../src/modules/professions/infrastructure/schema.ts";
import {
  finishedMatches,
  finishedPlayers,
} from "../../../src/modules/battleground/infrastructure/schema.ts";
import {
  experienceGrants,
  heroes,
  heroBotKills,
  heroProfessions,
  heroLearnedBonuses,
  heroPersonalDetails,
  heroReputations,
  heroSkills,
} from "../../../src/modules/character/infrastructure/schema.ts";
import { finishedFights } from "../../../src/modules/combat/infrastructure/schema.ts";
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
import { letters, letterAttachments } from "../../../src/modules/mail/infrastructure/schema.ts";
import { listings } from "../../../src/modules/auction/infrastructure/schema.ts";
import {
  copies,
  binds,
  killedSpawns,
} from "../../../src/modules/instance/infrastructure/schema.ts";
import {
  parties,
  partyBagItems,
  partyInvites,
  partyMembers,
} from "../../../src/modules/party/infrastructure/schema.ts";
import { areaLinks, areas, huntSpawns } from "../../../src/modules/world/infrastructure/schema.ts";
import { requireTestDatabaseUrl } from "../../support/postgres/test-database-url.ts";

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
          WHERE schema_name IN ('identity','character','catalog','inventory','world','combat','content','mail','auction','party','instance','battleground','professions','quests','social','economy')`,
    );
    expect(schemas.sort()).toEqual([
      "auction",
      "battleground",
      "catalog",
      "character",
      "combat",
      "content",
      "identity",
      "instance",
      "inventory",
      "mail",
      "party",
      "professions",
      "world",
    ]);

    const tables = await names(
      sql`SELECT table_schema || '.' || table_name AS name
          FROM information_schema.tables
          WHERE table_schema IN ('identity','character','catalog','inventory','world','combat','content','mail','auction','party','instance','battleground','professions')
            AND table_type = 'BASE TABLE'`,
    );
    expect(tables.sort()).toEqual(
      [
        "auction.listings",
        "battleground.finished_matches",
        "battleground.finished_players",
        "catalog.appearance_presets",
        "catalog.area_farms",
        "catalog.artifacts",
        "catalog.assistant_types",
        "catalog.bonuses",
        "catalog.bot_loot_entries",
        "catalog.bot_spell_book_spells",
        "catalog.bot_spell_books",
        "catalog.bots",
        "catalog.craft_recipes",
        "catalog.dungeon_areas",
        "catalog.dungeon_spawn_encounters",
        "catalog.dungeon_spawn_routes",
        "catalog.dungeon_spawn_zones",
        "catalog.dungeon_spawns",
        "catalog.dungeons",
        "catalog.farm_resources",
        "catalog.battlegrounds",
        "catalog.battleground_rooms",
        "catalog.battleground_leader_groups",
        "catalog.game_wide_documents",
        "catalog.level_boundaries",
        "catalog.level_skill_values",
        "catalog.skill_definitions",
        "catalog.store_lots",
        "catalog.store_types",
        "catalog.use_scripts",
        "catalog.reputation_tracks",
        "catalog.professions",
        "character.experience_grants",
        "character.hero_bot_kills",
        "character.hero_professions",
        "character.hero_learned_bonuses",
        "character.hero_personal_details",
        "character.hero_reputations",
        "character.hero_skills",
        "character.heroes",
        "combat.finished_fights",
        "content.active_release",
        "content.bootstrap_imports",
        "content.draft_versions",
        "content.drafts",
        "content.release_entries",
        "content.releases",
        "identity.accounts",
        "identity.sessions",
        "instance.binds",
        "instance.copies",
        "instance.killed_spawns",
        "inventory.items",
        "mail.letter_attachments",
        "mail.letters",
        "party.parties",
        "party.party_bag_items",
        "party.party_invites",
        "party.party_members",
        "professions.farm_stocks",
        "professions.hero_assistants",
        "professions.hero_farm_stats",
        "professions.hero_recipes",
        "world.area_links",
        "world.areas",
        "world.hunt_spawns",
      ].sort(),
    );
    expect(tables).not.toEqual(
      expect.arrayContaining(["combat.events", "combat.fights", "combat.participants"]),
    );
    expect([
      accounts,
      sessions,
      artifacts,
      botLootEntries,
      botSpellBooks,
      botSpellBookSpells,
      bots,
      dungeons,
      dungeonAreas,
      dungeonSpawns,
      dungeonSpawnEncounters,
      dungeonSpawnRoutes,
      dungeonSpawnZones,
      battlegrounds,
      battlegroundRooms,
      battlegroundLeaderGroups,
      skillDefinitions,
      levelBoundaries,
      levelSkillValues,
      appearancePresets,
      gameWideDocuments,
      storeTypes,
      storeLots,
      reputationTracks,
      professions,
      craftRecipes,
      assistantTypes,
      farmResources,
      areaFarms,
      bonuses,
      useScripts,
      areas,
      areaLinks,
      huntSpawns,
      heroes,
      heroLearnedBonuses,
      heroPersonalDetails,
      heroSkills,
      heroReputations,
      heroBotKills,
      heroProfessions,
      experienceGrants,
      items,
      letters,
      letterAttachments,
      listings,
      parties,
      partyMembers,
      partyInvites,
      partyBagItems,
      copies,
      binds,
      killedSpawns,
      finishedMatches,
      finishedPlayers,
      finishedFights,
      heroAssistants,
      heroFarmStats,
      farmStocks,
      heroRecipes,
      drafts,
      draftVersions,
      releases,
      releaseEntries,
      activeRelease,
      bootstrapImports,
    ]).toHaveLength(66);

    const sqlFiles = fs
      .readdirSync(drizzleFolder)
      .filter((name) => name.endsWith(".sql"))
      .sort();
    expect(sqlFiles).toEqual([
      "0000_foundation_init.sql",
      "0001_inventory_item_upgrade.sql",
      "0002_inventory_item_tempeffect.sql",
      "0003_inventory_item_expire_use.sql",
      "0004_content_draft_use_types.sql",
      "0005_catalog_bot_spell_book.sql",
      "0006_world_hunt_spawn_wander.sql",
      "0007_catalog_store_lot_pay.sql",
      "0008_mail_letters.sql",
      "0009_mail_letter_attachments.sql",
      "0010_auction_listings.sql",
      "0011_auction_tenders.sql",
      "0012_party_foundation.sql",
      "0013_party_bag_items.sql",
      "0014_instance_foundation.sql",
      "0015_catalog_dungeon_spawn_zone.sql",
      "0016_battleground_history_and_copy_type.sql",
      "0017_character_hero_bot_kills.sql",
      "0018_profession_catalog_and_hero_licenses.sql",
      "0019_professions_assistants_and_farms.sql",
      "0020_professions_craft_recipes.sql",
    ]);
    const journal = JSON.parse(
      fs.readFileSync(path.join(drizzleFolder, "meta/_journal.json"), "utf8"),
    ) as { entries: Array<{ tag: string }> };
    expect(journal.entries.map((entry) => entry.tag)).toEqual([
      "0000_foundation_init",
      "0001_inventory_item_upgrade",
      "0002_inventory_item_tempeffect",
      "0003_inventory_item_expire_use",
      "0004_content_draft_use_types",
      "0005_catalog_bot_spell_book",
      "0006_world_hunt_spawn_wander",
      "0007_catalog_store_lot_pay",
      "0008_mail_letters",
      "0009_mail_letter_attachments",
      "0010_auction_listings",
      "0011_auction_tenders",
      "0012_party_foundation",
      "0013_party_bag_items",
      "0014_instance_foundation",
      "0015_catalog_dungeon_spawn_zone",
      "0016_battleground_history_and_copy_type",
      "0017_character_hero_bot_kills",
      "0018_profession_catalog_and_hero_licenses",
      "0019_professions_assistants_and_farms",
      "0020_professions_craft_recipes",
    ]);
    expect(await appliedCount()).toBe(21);
    expect(fs.readFileSync(path.join(drizzleFolder, "0000_foundation_init.sql"), "utf8")).toMatch(
      /INSERT INTO "content"\."active_release"/,
    );

    const singleton = await database
      .session()
      .execute<{ lock_id: number }>(sql`SELECT lock_id FROM content.active_release`);
    expect([...singleton].map((row) => row.lock_id)).toEqual([1]);

    const upgradeColumns = await database.session().execute<{
      column_name: string;
      is_nullable: string;
      column_default: string | null;
    }>(
      sql`SELECT column_name, is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'inventory' AND table_name = 'items'
            AND column_name IN ('upgrade_id', 'upgrade_level', 'upgrade_skill_id', 'upgrade_bound')
          ORDER BY column_name`,
    );
    expect(
      [...upgradeColumns].map((row) => ({
        column_name: row.column_name,
        is_nullable: row.is_nullable,
        column_default: row.column_default,
      })),
    ).toEqual([
      { column_name: "upgrade_bound", is_nullable: "NO", column_default: null },
      { column_name: "upgrade_id", is_nullable: "NO", column_default: null },
      { column_name: "upgrade_level", is_nullable: "NO", column_default: null },
      { column_name: "upgrade_skill_id", is_nullable: "NO", column_default: null },
    ]);
    const expireColumn = await database.session().execute<{
      is_nullable: string;
      column_default: string | null;
    }>(
      sql`SELECT is_nullable, column_default
          FROM information_schema.columns
          WHERE table_schema = 'inventory' AND table_name = 'items' AND column_name = 'expire'`,
    );
    expect([...expireColumn]).toEqual([{ is_nullable: "NO", column_default: null }]);
    const draftTypes = await database.session().execute<{ check_clause: string }>(
      sql`SELECT check_clause
          FROM information_schema.check_constraints
          WHERE constraint_schema = 'content' AND constraint_name = 'drafts_content_type_check'`,
    );
    expect([...draftTypes].map((row) => row.check_clause).join(" ")).toMatch(/bonus/);
    expect([...draftTypes].map((row) => row.check_clause).join(" ")).toMatch(/use_script/);
    expect([...draftTypes].map((row) => row.check_clause).join(" ")).toMatch(/dungeon/);
    expect([...draftTypes].map((row) => row.check_clause).join(" ")).toMatch(/profession/);
    expect([...draftTypes].map((row) => row.check_clause).join(" ")).toMatch(/assistant_type/);
    expect([...draftTypes].map((row) => row.check_clause).join(" ")).toMatch(/farm_resource/);
    expect([...draftTypes].map((row) => row.check_clause).join(" ")).toMatch(/area_farm/);
    expect([...draftTypes].map((row) => row.check_clause).join(" ")).toMatch(/craft_recipe/);
    const tempeffectCheck = await database.session().execute<{ check_clause: string }>(
      sql`SELECT check_clause
          FROM information_schema.check_constraints
          WHERE constraint_schema = 'inventory' AND constraint_name = 'items_location_kind_check'`,
    );
    expect([...tempeffectCheck].map((row) => row.check_clause).join(" ")).toMatch(/tempeffect/);
    const storeLotPay = await database.session().execute<{
      column_name: string;
      is_nullable: string;
      data_type: string;
    }>(
      sql`SELECT column_name, is_nullable, data_type
          FROM information_schema.columns
          WHERE table_schema = 'catalog' AND table_name = 'store_lots'
            AND column_name IN ('pay', 'requires')
          ORDER BY column_name`,
    );
    expect(
      [...storeLotPay].map((row) => ({
        column_name: row.column_name,
        is_nullable: row.is_nullable,
        data_type: row.data_type,
      })),
    ).toEqual([
      { column_name: "pay", is_nullable: "NO", data_type: "jsonb" },
      { column_name: "requires", is_nullable: "YES", data_type: "jsonb" },
    ]);
    const mailLetters = await database.session().execute<{
      column_name: string;
      is_nullable: string;
    }>(
      sql`SELECT column_name, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'mail' AND table_name = 'letters'
            AND column_name IN ('body', 'money_come_minor', 'system')
          ORDER BY column_name`,
    );
    expect(
      [...mailLetters].map((row) => ({
        column_name: row.column_name,
        is_nullable: row.is_nullable,
      })),
    ).toEqual([
      { column_name: "body", is_nullable: "NO" },
      { column_name: "money_come_minor", is_nullable: "NO" },
      { column_name: "system", is_nullable: "NO" },
    ]);
    const mailAttach = await database.session().execute<{
      column_name: string;
      is_nullable: string;
    }>(
      sql`SELECT column_name, is_nullable
          FROM information_schema.columns
          WHERE table_schema = 'mail' AND table_name = 'letter_attachments'
            AND column_name IN ('original_item_id', 'artifact_id', 'ord')
          ORDER BY column_name`,
    );
    expect(
      [...mailAttach].map((row) => ({
        column_name: row.column_name,
        is_nullable: row.is_nullable,
      })),
    ).toEqual([
      { column_name: "artifact_id", is_nullable: "NO" },
      { column_name: "ord", is_nullable: "NO" },
      { column_name: "original_item_id", is_nullable: "NO" },
    ]);
  });

  it("applies database identifier defaults and bounded item sequence", async () => {
    const identityColumns = await database.session().execute<{
      table_name: string;
      column_name: string;
      is_identity: string;
      identity_generation: string | null;
      data_type: string;
    }>(
      sql`SELECT table_name, column_name, is_identity, identity_generation, data_type
          FROM information_schema.columns
          WHERE (table_schema = 'identity' AND table_name = 'accounts' AND column_name = 'id')
             OR (table_schema = 'character' AND table_name = 'heroes' AND column_name = 'id')
          ORDER BY table_name`,
    );
    expect(
      [...identityColumns].map((row) => ({
        table_name: row.table_name,
        column_name: row.column_name,
        is_identity: row.is_identity,
        identity_generation: row.identity_generation,
        data_type: row.data_type,
      })),
    ).toEqual([
      {
        table_name: "accounts",
        column_name: "id",
        is_identity: "YES",
        identity_generation: "ALWAYS",
        data_type: "integer",
      },
      {
        table_name: "heroes",
        column_name: "id",
        is_identity: "YES",
        identity_generation: "ALWAYS",
        data_type: "integer",
      },
    ]);
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
    expect(itemSequence).toEqual([{ min_value: "100000", max_value: "2147483647", cycle: false }]);

    const identitySequences = await database.session().execute<{
      schema: string;
      sequencename: string;
      start_value: string;
      min_value: string;
      max_value: string;
      cycle: boolean;
    }>(
      sql`SELECT schemaname AS schema, sequencename, start_value::text AS start_value,
                 min_value::text AS min_value, max_value::text AS max_value, cycle
          FROM pg_sequences
          WHERE (schemaname = 'identity' AND sequencename = 'accounts_id_seq')
             OR (schemaname = 'character' AND sequencename = 'heroes_id_seq')
          ORDER BY schemaname`,
    );
    expect([...identitySequences]).toEqual([
      {
        schema: "character",
        sequencename: "heroes_id_seq",
        start_value: "1",
        min_value: "1",
        max_value: "2147483647",
        cycle: false,
      },
      {
        schema: "identity",
        sequencename: "accounts_id_seq",
        start_value: "1",
        min_value: "1",
        max_value: "2147483647",
        cycle: false,
      },
    ]);

    const combatSequences = await database.session().execute<{
      sequencename: string;
      start_value: string;
      min_value: string;
      max_value: string;
      cycle: boolean;
    }>(
      sql`SELECT sequencename, start_value::text AS start_value, min_value::text AS min_value,
                 max_value::text AS max_value, cycle
          FROM pg_sequences
          WHERE schemaname = 'combat'
          ORDER BY sequencename`,
    );
    expect([...combatSequences]).toEqual([
      {
        sequencename: "fight_id_seq",
        start_value: "1",
        min_value: "1",
        max_value: "2147483647",
        cycle: false,
      },
    ]);

    const participantGone = await database.session().execute<{ count: string }>(
      sql`SELECT count(*)::text AS count FROM pg_sequences
          WHERE schemaname = 'combat' AND sequencename = 'participant_id_seq'`,
    );
    expect(participantGone[0]?.count).toBe("0");

    const identityTypes = await database.session().execute<{
      table_name: string;
      column_name: string;
      data_type: string;
      udt_name: string;
    }>(
      sql`SELECT table_name, column_name, data_type, udt_name
          FROM information_schema.columns
          WHERE (table_schema = 'identity' AND table_name = 'accounts' AND column_name = 'id')
             OR (table_schema = 'identity' AND table_name = 'sessions' AND column_name = 'account_id')
             OR (table_schema = 'character' AND table_name = 'heroes' AND column_name IN ('id', 'account_id'))
             OR (table_schema = 'inventory' AND table_name = 'items' AND column_name = 'hero_id')
          ORDER BY table_name, column_name`,
    );
    expect(
      [...identityTypes].map((row) => ({
        table_name: row.table_name,
        column_name: row.column_name,
        data_type: row.data_type,
        udt_name: row.udt_name,
      })),
    ).toEqual([
      { table_name: "accounts", column_name: "id", data_type: "integer", udt_name: "int4" },
      { table_name: "heroes", column_name: "account_id", data_type: "integer", udt_name: "int4" },
      { table_name: "heroes", column_name: "id", data_type: "integer", udt_name: "int4" },
      { table_name: "items", column_name: "hero_id", data_type: "integer", udt_name: "int4" },
      { table_name: "sessions", column_name: "account_id", data_type: "integer", udt_name: "int4" },
    ]);

    const finishedFightColumns = await database.session().execute<{
      column_name: string;
      data_type: string;
      udt_name: string;
    }>(
      sql`SELECT column_name, data_type, udt_name
          FROM information_schema.columns
          WHERE table_schema = 'combat' AND table_name = 'finished_fights'
          ORDER BY ordinal_position`,
    );
    expect(
      [...finishedFightColumns].map((row) => ({
        column_name: row.column_name,
        data_type: row.data_type,
        udt_name: row.udt_name,
      })),
    ).toEqual([
      { column_name: "id", data_type: "bigint", udt_name: "int8" },
      { column_name: "account_id", data_type: "integer", udt_name: "int4" },
      { column_name: "hero_id", data_type: "integer", udt_name: "int4" },
      { column_name: "title", data_type: "text", udt_name: "text" },
      { column_name: "type", data_type: "integer", udt_name: "int4" },
      { column_name: "timeout", data_type: "integer", udt_name: "int4" },
      { column_name: "level_min", data_type: "integer", udt_name: "int4" },
      { column_name: "level_max", data_type: "integer", udt_name: "int4" },
      { column_name: "level", data_type: "integer", udt_name: "int4" },
      { column_name: "ml_title", data_type: "text", udt_name: "text" },
      { column_name: "winner", data_type: "integer", udt_name: "int4" },
      { column_name: "started", data_type: "text", udt_name: "text" },
      { column_name: "duration", data_type: "integer", udt_name: "int4" },
      { column_name: "teams", data_type: "jsonb", udt_name: "jsonb" },
      { column_name: "area_id", data_type: "text", udt_name: "text" },
      {
        column_name: "finished_at",
        data_type: "timestamp with time zone",
        udt_name: "timestamptz",
      },
    ]);
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

function copyMigrations(): string {
  const destination = fs.mkdtempSync(path.join(os.tmpdir(), "j-emu-drizzle-"));
  const journal = JSON.parse(
    fs.readFileSync(path.join(drizzleFolder, "meta/_journal.json"), "utf8"),
  ) as {
    version: string;
    dialect: string;
    entries: Array<{ tag: string }>;
  };
  fs.mkdirSync(path.join(destination, "meta"), { recursive: true });
  fs.writeFileSync(path.join(destination, "meta/_journal.json"), JSON.stringify(journal, null, 2));
  for (const entry of journal.entries) {
    fs.copyFileSync(
      path.join(drizzleFolder, `${entry.tag}.sql`),
      path.join(destination, `${entry.tag}.sql`),
    );
  }
  return destination;
}
