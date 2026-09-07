import { pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

const identitySchema = pgSchema("identity");

export const accounts = identitySchema.table("accounts", {
  id: uuid("id").primaryKey().defaultRandom(),
  login: text("login").notNull().unique(),
  nick: text("nick").notNull().unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});

export const sessions = identitySchema.table("sessions", {
  id: text("id").primaryKey(),
  accountId: uuid("account_id").notNull().unique(),
  sessionKey: text("session_key").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
});
