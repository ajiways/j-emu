import { sql } from "drizzle-orm";
import { check, integer, pgSchema, primaryKey, text, uniqueIndex } from "drizzle-orm/pg-core";
import { heroes } from "../../character/infrastructure/schema.ts";

export const battlegroundSchema = pgSchema("battleground");

export const finishedMatches = battlegroundSchema.table(
  "finished_matches",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity({
      startWith: 1,
      minValue: 1,
      maxValue: 2_147_483_647,
      cycle: false,
    }),
    copyId: integer("copy_id").notNull(),
    bgId: text("bg_id").notNull(),
    bgType: text("bg_type").notNull(),
    instArtikulId: text("inst_artikul_id").notNull(),
    title: text("title").notNull(),
    timeStart: integer("time_start").notNull(),
    timeFinish: integer("time_finish").notNull(),
    levelMin: integer("level_min").notNull(),
    levelMax: integer("level_max").notNull(),
    maxScore: integer("max_score").notNull(),
    scoreLeague: integer("score_league").notNull(),
    scoreCohort: integer("score_cohort").notNull(),
    winnerKind: integer("winner_kind").notNull(),
  },
  (table) => [
    check("finished_matches_id_check", sql`${table.id} > 0`),
    check("finished_matches_copy_id_check", sql`${table.copyId} > 0`),
    check("finished_matches_times_check", sql`${table.timeFinish} >= ${table.timeStart}`),
    check("finished_matches_winner_kind_check", sql`${table.winnerKind} IN (0, 2, 3)`),
    uniqueIndex("battleground_finished_matches_copy_uidx").on(table.copyId),
  ],
);

export const finishedPlayers = battlegroundSchema.table(
  "finished_players",
  {
    matchId: integer("match_id")
      .notNull()
      .references(() => finishedMatches.id, { onDelete: "restrict" }),
    heroId: integer("hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    nick: text("nick").notNull(),
    level: integer("level").notNull(),
    kind: integer("kind").notNull(),
    dmg: integer("dmg").notNull(),
    exp: integer("exp").notNull(),
    honor: integer("honor").notNull(),
    honorBonus: integer("honor_bonus").notNull(),
    killCnt: integer("kill_cnt").notNull(),
    deathCnt: integer("death_cnt").notNull(),
    fatalityCnt: integer("fatality_cnt").notNull(),
    rank: text("rank").notNull(),
    returnAreaId: text("return_area_id").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.matchId, table.heroId] }),
    check("finished_players_hero_id_check", sql`${table.heroId} > 0`),
    check("finished_players_kind_check", sql`${table.kind} IN (2, 3)`),
  ],
);
