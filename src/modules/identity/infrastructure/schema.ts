import { integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core";

const identitySchema = pgSchema("identity");

export const accounts = identitySchema.table("accounts", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity({
    startWith: 1,
    minValue: 1,
    maxValue: 2_147_483_647,
    cycle: false,
  }),
  login: text("login").notNull().unique(),
  nick: text("nick").notNull().unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const sessions = identitySchema.table("sessions", {
  id: text("id").primaryKey(),
  accountId: integer("account_id").notNull().unique(),
  sessionKey: text("session_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});
