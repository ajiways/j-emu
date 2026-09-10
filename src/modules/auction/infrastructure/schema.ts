import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgSchema, text, timestamp } from "drizzle-orm/pg-core";
import { heroes } from "../../character/infrastructure/schema.ts";

export const auctionSchema = pgSchema("auction");

export const listings = auctionSchema.table(
  "listings",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity({
      startWith: 1,
      minValue: 1,
      maxValue: 2_147_483_647,
      cycle: false,
    }),
    kind: text("kind").notNull(),
    status: text("status").notNull(),
    ownerHeroId: integer("owner_hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    ownerKind: integer("owner_kind").notNull(),
    artikulId: integer("artikul_id").notNull(),
    title: text("title").notNull(),
    kindId: integer("kind_id").notNull(),
    quality: integer("quality").notNull(),
    levelMin: integer("level_min").notNull(),
    amount: integer("amount").notNull(),
    startPriceMinor: bigint("start_price_minor", { mode: "bigint" }).notNull(),
    buyoutMinor: bigint("buyout_minor", { mode: "bigint" }).notNull(),
    currentBidMinor: bigint("current_bid_minor", { mode: "bigint" }).notNull(),
    bidderHeroId: integer("bidder_hero_id").references(() => heroes.id, {
      onDelete: "restrict",
    }),
    cancelFeeMinor: bigint("cancel_fee_minor", { mode: "bigint" }).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true, mode: "date" }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true, mode: "date" }).notNull(),
    originalItemId: integer("original_item_id").notNull(),
    durability: integer("durability").notNull(),
    durabilityMax: integer("durability_max").notNull(),
    upgradeId: integer("upgrade_id").notNull(),
    upgradeLevel: integer("upgrade_level").notNull(),
    upgradeSkillId: text("upgrade_skill_id").notNull(),
    upgradeBound: integer("upgrade_bound").notNull(),
  },
  (table) => [
    check("listings_id_check", sql`${table.id} > 0`),
    check("listings_kind_check", sql`${table.kind} IN ('lot')`),
    check(
      "listings_status_check",
      sql`${table.status} IN ('open', 'sold', 'cancelled', 'expired')`,
    ),
    check("listings_owner_kind_check", sql`${table.ownerKind} > 0`),
    check("listings_artikul_id_check", sql`${table.artikulId} > 0`),
    check("listings_kind_id_check", sql`${table.kindId} >= 0`),
    check("listings_quality_check", sql`${table.quality} >= 0`),
    check("listings_level_min_check", sql`${table.levelMin} >= 0`),
    check("listings_amount_check", sql`${table.amount} > 0`),
    check("listings_start_price_minor_check", sql`${table.startPriceMinor} >= 0`),
    check("listings_buyout_minor_check", sql`${table.buyoutMinor} >= 0`),
    check("listings_current_bid_minor_check", sql`${table.currentBidMinor} >= 0`),
    check("listings_cancel_fee_minor_check", sql`${table.cancelFeeMinor} >= 0`),
    check("listings_original_item_id_check", sql`${table.originalItemId} > 0`),
    check("listings_durability_check", sql`${table.durability} >= 0`),
    check("listings_durability_max_check", sql`${table.durabilityMax} >= 0`),
    check("listings_durability_range_check", sql`${table.durability} <= ${table.durabilityMax}`),
    check("listings_upgrade_id_check", sql`${table.upgradeId} >= 0`),
    check(
      "listings_upgrade_level_check",
      sql`${table.upgradeLevel} >= 0 AND ${table.upgradeLevel} <= 6`,
    ),
    check("listings_upgrade_bound_check", sql`${table.upgradeBound} IN (0, 1)`),
    index("auction_listings_status_exp_idx").on(table.status, table.expiresAt),
    index("auction_listings_kind_status_idx").on(table.kind, table.status),
    index("auction_listings_owner_idx").on(table.ownerHeroId),
    index("auction_listings_bidder_idx").on(table.bidderHeroId),
    index("auction_listings_artikul_idx").on(table.artikulId),
  ],
);
