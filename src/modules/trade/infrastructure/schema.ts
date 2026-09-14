import { sql } from "drizzle-orm";
import { check, integer, pgSchema, text, unique } from "drizzle-orm/pg-core";
import { heroes } from "../../character/infrastructure/schema.ts";

export const tradeSchema = pgSchema("trade");

export const heldItems = tradeSchema.table(
  "held_items",
  {
    id: integer("id").primaryKey().generatedAlwaysAsIdentity({
      startWith: 1,
      minValue: 1,
      maxValue: 2_147_483_647,
      cycle: false,
    }),
    heroId: integer("hero_id")
      .notNull()
      .references(() => heroes.id, { onDelete: "restrict" }),
    originalItemId: integer("original_item_id").notNull(),
    artifactId: integer("artifact_id").notNull(),
    quantity: integer("quantity").notNull(),
    durability: integer("durability").notNull(),
    durabilityMax: integer("durability_max").notNull(),
    upgradeId: integer("upgrade_id").notNull(),
    upgradeLevel: integer("upgrade_level").notNull(),
    upgradeSkillId: text("upgrade_skill_id").notNull(),
    upgradeBound: integer("upgrade_bound").notNull(),
  },
  (table) => [
    unique("held_items_hero_original_unique").on(table.heroId, table.originalItemId),
    check("held_items_id_check", sql`${table.id} > 0`),
    check("held_items_hero_id_check", sql`${table.heroId} > 0`),
    check("held_items_original_item_id_check", sql`${table.originalItemId} > 0`),
    check("held_items_artifact_id_check", sql`${table.artifactId} > 0`),
    check("held_items_quantity_check", sql`${table.quantity} > 0`),
    check("held_items_durability_check", sql`${table.durability} >= 0`),
    check("held_items_durability_max_check", sql`${table.durabilityMax} >= 0`),
    check("held_items_upgrade_id_check", sql`${table.upgradeId} >= 0`),
    check(
      "held_items_upgrade_level_check",
      sql`${table.upgradeLevel} >= 0 AND ${table.upgradeLevel} <= 6`,
    ),
    check("held_items_upgrade_bound_check", sql`${table.upgradeBound} IN (0, 1)`),
  ],
);
