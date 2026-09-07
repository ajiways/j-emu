CREATE SCHEMA "inventory";
--> statement-breakpoint
CREATE SEQUENCE "inventory"."item_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1000000000 CACHE 1;--> statement-breakpoint
CREATE TABLE "inventory"."items" (
	"id" bigint PRIMARY KEY NOT NULL,
	"hero_id" uuid NOT NULL,
	"artifact_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"location_kind" text NOT NULL,
	"pocket_position" integer,
	"equipment_slot" integer,
	"version" integer NOT NULL,
	CONSTRAINT "items_id_fight_safe" CHECK ("inventory"."items"."id" >= 1000000000),
	CONSTRAINT "items_quantity_check" CHECK ("inventory"."items"."quantity" > 0),
	CONSTRAINT "items_version_check" CHECK ("inventory"."items"."version" > 0),
	CONSTRAINT "items_location_kind_check" CHECK ("inventory"."items"."location_kind" IN ('bag', 'pocket', 'equipment')),
	CONSTRAINT "items_location_check" CHECK ((
        ("inventory"."items"."location_kind" = 'bag' AND "inventory"."items"."pocket_position" IS NULL AND "inventory"."items"."equipment_slot" IS NULL)
        OR ("inventory"."items"."location_kind" = 'pocket' AND "inventory"."items"."pocket_position" > 0 AND "inventory"."items"."equipment_slot" IS NULL)
        OR ("inventory"."items"."location_kind" = 'equipment' AND "inventory"."items"."equipment_slot" > 0 AND "inventory"."items"."pocket_position" IS NULL)
      ))
);
--> statement-breakpoint
CREATE INDEX "inventory_items_hero_idx" ON "inventory"."items" USING btree ("hero_id");