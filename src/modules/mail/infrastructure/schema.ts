import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { heroes } from "../../character/infrastructure/schema.ts";

export const mailSchema = pgSchema("mail");

export const letters = mailSchema.table(
  "letters",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity({
      startWith: 1,
      minValue: 1,
      maxValue: 2_147_483_647,
      cycle: false,
    }),
    ownerHeroId: integer("owner_hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    folder: text("folder").notNull(),
    peerHeroId: integer("peer_hero_id").references(() => heroes.id, {
      onDelete: "restrict",
    }),
    peerNick: text("peer_nick").notNull(),
    subject: text("subject").notNull(),
    body: text("body").notNull(),
    sentAt: timestamp("sent_at", { withTimezone: true, mode: "date" }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    flags: integer("flags").notNull(),
    moneyComeMinor: bigint("money_come_minor", { mode: "bigint" }).notNull(),
    paymentMinor: bigint("payment_minor", { mode: "bigint" }).notNull(),
    taxMinor: bigint("tax_minor", { mode: "bigint" }).notNull(),
    moneyType: integer("money_type").notNull(),
    pairId: integer("pair_id"),
    system: integer("system").notNull(),
  },
  (table) => [
    check("letters_id_check", sql`${table.id} > 0`),
    check("letters_folder_check", sql`${table.folder} IN ('inbox', 'outbox')`),
    check("letters_flags_check", sql`${table.flags} >= 0`),
    check("letters_money_come_minor_check", sql`${table.moneyComeMinor} >= 0`),
    check("letters_payment_minor_check", sql`${table.paymentMinor} >= 0`),
    check("letters_tax_minor_check", sql`${table.taxMinor} >= 0`),
    check("letters_money_type_check", sql`${table.moneyType} IN (0, 1)`),
    check("letters_system_check", sql`${table.system} IN (0, 1)`),
    index("mail_letters_owner_folder_idx").on(table.ownerHeroId, table.folder),
    index("mail_letters_expires_at_idx").on(table.expiresAt),
    index("mail_letters_pair_idx").on(table.pairId),
  ],
);
