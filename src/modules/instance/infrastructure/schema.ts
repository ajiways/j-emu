import { sql } from "drizzle-orm";
import { check, integer, pgSchema, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { heroes } from "../../character/infrastructure/schema.ts";

export const instanceSchema = pgSchema("instance");

export const copies = instanceSchema.table(
  "copies",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity({
      startWith: 1,
      minValue: 1,
      maxValue: 2_147_483_647,
      cycle: false,
    }),
    copyType: text("copy_type").notNull(),
    artikulId: text("artikul_id").notNull(),
    createdUnix: integer("created_unix").notNull(),
    expiresUnix: integer("expires_unix").notNull(),
    pendingKick: integer("pending_kick").notNull(),
  },
  (table) => [
    check("copies_id_check", sql`${table.id} > 0`),
    check("copies_copy_type_check", sql`${table.copyType} = 'dungeon'`),
    check("copies_created_unix_check", sql`${table.createdUnix} > 0`),
    check("copies_expires_unix_check", sql`${table.expiresUnix} > ${table.createdUnix}`),
    check("copies_pending_kick_check", sql`${table.pendingKick} IN (0, 1)`),
    uniqueIndex("instance_copies_id_uidx").on(table.id),
  ],
);

export const binds = instanceSchema.table(
  "binds",
  {
    heroId: integer("hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    dungeonArtikulId: text("dungeon_artikul_id").notNull(),
    copyId: integer("copy_id")
      .notNull()
      .references(() => copies.id, { onDelete: "restrict" }),
    boundUnix: integer("bound_unix").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.heroId, table.dungeonArtikulId] }),
    check("binds_copy_id_check", sql`${table.copyId} > 0`),
    check("binds_bound_unix_check", sql`${table.boundUnix} > 0`),
  ],
);

export const killedSpawns = instanceSchema.table(
  "killed_spawns",
  {
    copyId: integer("copy_id")
      .notNull()
      .references(() => copies.id, { onDelete: "restrict" }),
    spawnKey: text("spawn_key").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.copyId, table.spawnKey] }),
    check("killed_spawns_copy_id_check", sql`${table.copyId} > 0`),
    check("killed_spawns_spawn_key_check", sql`char_length(${table.spawnKey}) BETWEEN 1 AND 64`),
  ],
);
