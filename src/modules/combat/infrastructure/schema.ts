import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  index,
  integer,
  jsonb,
  pgSchema,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { heroes } from "../../character/infrastructure/schema.ts";
import { accounts } from "../../identity/infrastructure/schema.ts";

export const combatSchema = pgSchema("combat");

export const fightIdSeq = combatSchema.sequence("fight_id_seq", {
  startWith: 1,
  minValue: 1,
  maxValue: 2_147_483_647,
  cycle: false,
});

export const finishedFights = combatSchema.table(
  "finished_fights",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey(),
    accountId: integer("account_id")
      .notNull()
      .references(() => accounts.id, { onDelete: "restrict" }),
    heroId: integer("hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    type: integer("type").notNull(),
    timeout: integer("timeout").notNull(),
    levelMin: integer("level_min").notNull(),
    levelMax: integer("level_max").notNull(),
    level: integer("level").notNull(),
    mlTitle: text("ml_title").notNull(),
    winner: integer("winner").notNull(),
    started: text("started").notNull(),
    duration: integer("duration").notNull(),
    teams: jsonb("teams").notNull(),
    areaId: text("area_id").notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    check("finished_fights_id_check", sql`${table.id} > 0`),
    check("finished_fights_type_check", sql`${table.type} > 0`),
    check("finished_fights_timeout_check", sql`${table.timeout} > 0`),
    check("finished_fights_level_min_check", sql`${table.levelMin} > 0`),
    check("finished_fights_level_max_check", sql`${table.levelMax} >= ${table.levelMin}`),
    check("finished_fights_level_check", sql`${table.level} >= 0`),
    check("finished_fights_winner_check", sql`${table.winner} IN (1, 2)`),
    check("finished_fights_duration_check", sql`${table.duration} >= 0`),
    index("finished_fights_area_finished_idx").on(table.areaId, table.finishedAt),
    index("finished_fights_account_finished_idx").on(table.accountId, table.finishedAt),
    index("finished_fights_finished_at_idx").on(table.finishedAt),
  ],
);
