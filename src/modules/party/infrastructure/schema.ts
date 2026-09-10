import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  pgSchema,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { heroes } from "../../character/infrastructure/schema.ts";

export const partySchema = pgSchema("party");

export const parties = partySchema.table(
  "parties",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity({
      startWith: 1,
      minValue: 1,
      maxValue: 2_147_483_647,
      cycle: false,
    }),
    leaderHeroId: integer("leader_hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    lootRules: text("loot_rules").notNull(),
    noChat: integer("no_chat").notNull(),
    flags: integer("flags").notNull(),
    isSearch: integer("is_search").notNull(),
    password: text("password").notNull(),
    instanceArtikulId: text("instance_artikul_id").notNull(),
    botArtikulId: text("bot_artikul_id").notNull(),
    type: text("type").notNull(),
    distributeReadyAt: integer("distribute_ready_at").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    check("parties_id_check", sql`${table.id} > 0`),
    check("parties_loot_rules_check", sql`${table.lootRules} IN ('1', '2', '3')`),
    check("parties_no_chat_check", sql`${table.noChat} IN (0, 1)`),
    check("parties_flags_check", sql`${table.flags} >= 0`),
    check("parties_is_search_check", sql`${table.isSearch} IN (0, 1)`),
    check("parties_distribute_ready_at_check", sql`${table.distributeReadyAt} >= 0`),
    index("party_parties_is_search_idx").on(table.isSearch),
  ],
);

export const partyMembers = partySchema.table(
  "party_members",
  {
    partyId: integer("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    heroId: integer("hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    accountId: integer("account_id").notNull(),
    joinedAt: timestamp("joined_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.partyId, table.heroId] }),
    uniqueIndex("party_members_hero_uidx").on(table.heroId),
    check("party_members_account_id_check", sql`${table.accountId} > 0`),
  ],
);

export const partyInvites = partySchema.table(
  "party_invites",
  {
    partyId: integer("party_id")
      .notNull()
      .references(() => parties.id, { onDelete: "restrict" }),
    targetHeroId: integer("target_hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    fromHeroId: integer("from_hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.partyId, table.targetHeroId] })],
);
