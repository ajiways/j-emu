import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgSchema, text } from "drizzle-orm/pg-core";

export const inventorySchema = pgSchema("inventory");

export const itemIdSeq = inventorySchema.sequence("item_id_seq", {
  startWith: 100_000,
  minValue: 100_000,
  maxValue: 2_147_483_647,
  cycle: false,
});

export const items = inventorySchema.table(
  "items",
  {
    id: bigint("id", { mode: "bigint" })
      .primaryKey()
      .default(sql`nextval('inventory.item_id_seq'::regclass)`),
    heroId: integer("hero_id").notNull(),
    artifactId: integer("artifact_id").notNull(),
    quantity: integer("quantity").notNull(),
    locationKind: text("location_kind").notNull(),
    pocketPosition: integer("pocket_position"),
    equipmentSlot: integer("equipment_slot"),
    version: integer("version").notNull(),
  },
  (table) => [
    check("items_id_fight_safe", sql`${table.id} >= 100000`),
    check("items_quantity_check", sql`${table.quantity} > 0`),
    check("items_version_check", sql`${table.version} > 0`),
    check(
      "items_location_kind_check",
      sql`${table.locationKind} IN ('bag', 'pocket', 'equipment')`,
    ),
    check(
      "items_location_check",
      sql`(
        (${table.locationKind} = 'bag' AND ${table.pocketPosition} IS NULL AND ${table.equipmentSlot} IS NULL)
        OR (${table.locationKind} = 'pocket' AND ${table.pocketPosition} > 0 AND ${table.equipmentSlot} IS NULL)
        OR (${table.locationKind} = 'equipment' AND ${table.equipmentSlot} > 0 AND ${table.pocketPosition} IS NULL)
      )`,
    ),
    index("inventory_items_hero_idx").on(table.heroId),
  ],
);
