CREATE SCHEMA "trade";
--> statement-breakpoint
CREATE TABLE "trade"."held_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "trade"."held_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hero_id" integer NOT NULL,
	"original_item_id" integer NOT NULL,
	"artifact_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"durability" integer NOT NULL,
	"durability_max" integer NOT NULL,
	"upgrade_id" integer NOT NULL,
	"upgrade_level" integer NOT NULL,
	"upgrade_skill_id" text NOT NULL,
	"upgrade_bound" integer NOT NULL,
	CONSTRAINT "held_items_hero_original_unique" UNIQUE("hero_id","original_item_id"),
	CONSTRAINT "held_items_id_check" CHECK ("trade"."held_items"."id" > 0),
	CONSTRAINT "held_items_hero_id_check" CHECK ("trade"."held_items"."hero_id" > 0),
	CONSTRAINT "held_items_original_item_id_check" CHECK ("trade"."held_items"."original_item_id" > 0),
	CONSTRAINT "held_items_artifact_id_check" CHECK ("trade"."held_items"."artifact_id" > 0),
	CONSTRAINT "held_items_quantity_check" CHECK ("trade"."held_items"."quantity" > 0),
	CONSTRAINT "held_items_durability_check" CHECK ("trade"."held_items"."durability" >= 0),
	CONSTRAINT "held_items_durability_max_check" CHECK ("trade"."held_items"."durability_max" >= 0),
	CONSTRAINT "held_items_durability_range_check" CHECK ("trade"."held_items"."durability" <= "trade"."held_items"."durability_max"),
	CONSTRAINT "held_items_upgrade_id_check" CHECK ("trade"."held_items"."upgrade_id" >= 0),
	CONSTRAINT "held_items_upgrade_level_check" CHECK ("trade"."held_items"."upgrade_level" >= 0 AND "trade"."held_items"."upgrade_level" <= 6),
	CONSTRAINT "held_items_upgrade_bound_check" CHECK ("trade"."held_items"."upgrade_bound" IN (0, 1))
);
--> statement-breakpoint
ALTER TABLE "trade"."held_items" ADD CONSTRAINT "held_items_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;