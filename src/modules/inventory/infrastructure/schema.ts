import { sql } from "drizzle-orm";
import { bigint, check, index, integer, pgSchema, text, uniqueIndex } from "drizzle-orm/pg-core";

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
    durability: integer("durability").notNull(),
    durabilityMax: integer("durability_max").notNull(),
    upgradeId: integer("upgrade_id").notNull(),
    upgradeLevel: integer("upgrade_level").notNull(),
    upgradeSkillId: text("upgrade_skill_id").notNull(),
    upgradeBound: integer("upgrade_bound").notNull(),
    expire: integer("expire").notNull(),
    version: integer("version").notNull(),
  },
  (table) => [
    check("items_id_fight_safe", sql`${table.id} >= 100000`),
    check(
      "items_quantity_check",
      sql`(
        (${table.locationKind} <> 'tempeffect' AND ${table.quantity} > 0)
        OR (${table.locationKind} = 'tempeffect' AND ${table.quantity} = 0)
      )`,
    ),
    check("items_version_check", sql`${table.version} > 0`),
    check("items_durability_check", sql`${table.durability} >= 0`),
    check("items_durability_max_check", sql`${table.durabilityMax} >= 0`),
    check("items_durability_range_check", sql`${table.durability} <= ${table.durabilityMax}`),
    check("items_upgrade_id_check", sql`${table.upgradeId} >= 0`),
    check(
      "items_upgrade_level_check",
      sql`${table.upgradeLevel} >= 0 AND ${table.upgradeLevel} <= 6`,
    ),
    check("items_upgrade_bound_check", sql`${table.upgradeBound} IN (0, 1)`),
    check("items_expire_check", sql`${table.expire} >= 0`),
    check(
      "items_upgrade_state_check",
      sql`(
        (${table.upgradeLevel} = 0 AND ${table.upgradeId} = 0 AND ${table.upgradeSkillId} = '' AND ${table.upgradeBound} = 0)
        OR (${table.upgradeLevel} > 0 AND ${table.upgradeId} IN (1, 2, 3) AND char_length(${table.upgradeSkillId}) > 0)
      )`,
    ),
    check(
      "items_location_kind_check",
      sql`${table.locationKind} IN ('bag', 'pocket', 'equipment', 'tempeffect')`,
    ),
    check(
      "items_location_check",
      sql`(
        (${table.locationKind} = 'bag' AND ${table.pocketPosition} IS NULL AND ${table.equipmentSlot} IS NULL)
        OR (${table.locationKind} = 'pocket' AND ${table.pocketPosition} > 0 AND ${table.equipmentSlot} IS NULL)
        OR (${table.locationKind} = 'equipment' AND ${table.equipmentSlot} > 0 AND ${table.pocketPosition} IS NULL)
        OR (${table.locationKind} = 'tempeffect' AND ${table.pocketPosition} IS NULL AND ${table.equipmentSlot} IS NULL)
      )`,
    ),
    index("inventory_items_hero_idx").on(table.heroId),
    uniqueIndex("inventory_items_hero_equipment_slot_uidx")
      .on(table.heroId, table.equipmentSlot)
      .where(sql`${table.locationKind} = 'equipment'`),
    uniqueIndex("inventory_items_hero_pocket_position_uidx")
      .on(table.heroId, table.pocketPosition)
      .where(sql`${table.locationKind} = 'pocket'`),
  ],
);
