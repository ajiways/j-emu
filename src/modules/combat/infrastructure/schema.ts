import { sql } from "drizzle-orm";
import {
  bigint,
  check,
  integer,
  jsonb,
  pgSchema,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

const combatSchema = pgSchema("combat");

export const fightIdSeq = combatSchema.sequence("fight_id_seq", {
  startWith: 100_000,
  cycle: false,
});

export const participantIdSeq = combatSchema.sequence("participant_id_seq", {
  startWith: 200_000,
  cycle: false,
});

export const fights = combatSchema.table(
  "fights",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey(),
    status: text("status").notNull(),
    rulesVersion: text("rules_version").notNull(),
    arena: text("arena").notNull(),
    startedAt: timestamp("started_at", { withTimezone: true, mode: "date" }).notNull(),
    finishedAt: timestamp("finished_at", { withTimezone: true, mode: "date" }),
  },
  (table) => [
    check("fights_status_check", sql`${table.status} IN ('active', 'finished', 'aborted')`),
  ],
);

export const participants = combatSchema.table(
  "participants",
  {
    fightId: bigint("fight_id", { mode: "bigint" })
      .notNull()
      .references(() => fights.id, { onDelete: "cascade" }),
    participantId: bigint("participant_id", { mode: "bigint" }).notNull(),
    heroId: uuid("hero_id"),
    botId: integer("bot_id"),
    team: smallint("team").notNull(),
    hp: integer("hp").notNull(),
    maxHp: integer("max_hp").notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.fightId, table.participantId] }),
    check("participants_team_check", sql`${table.team} IN (1, 2)`),
    check("participants_hp_check", sql`${table.hp} >= 0`),
    check("participants_max_hp_check", sql`${table.maxHp} > 0`),
    check("participants_actor_check", sql`(${table.heroId} IS NULL) <> (${table.botId} IS NULL)`),
  ],
);

export const events = combatSchema.table(
  "events",
  {
    fightId: bigint("fight_id", { mode: "bigint" })
      .notNull()
      .references(() => fights.id, { onDelete: "cascade" }),
    sequence: bigint("sequence", { mode: "bigint" }).notNull(),
    eventType: text("event_type").notNull(),
    eventVersion: integer("event_version").notNull(),
    payload: jsonb("payload").notNull(),
    occurredAt: timestamp("occurred_at", { withTimezone: true, mode: "date" }).notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.fightId, table.sequence] }),
    check("events_sequence_check", sql`${table.sequence} > 0`),
    check("events_event_version_check", sql`${table.eventVersion} > 0`),
  ],
);
