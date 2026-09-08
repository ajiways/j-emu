DELETE FROM "catalog"."artifacts";--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD COLUMN "level_min" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD COLUMN "level_max" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD COLUMN "gender" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD COLUMN "skills" jsonb NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_hero_equipment_slot_uidx" ON "inventory"."items" USING btree ("hero_id","equipment_slot") WHERE "inventory"."items"."location_kind" = 'equipment';--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD CONSTRAINT "artifacts_level_min_check" CHECK ("catalog"."artifacts"."level_min" >= 0);--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD CONSTRAINT "artifacts_level_max_check" CHECK ("catalog"."artifacts"."level_max" >= 0);--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD CONSTRAINT "artifacts_gender_check" CHECK ("catalog"."artifacts"."gender" >= 0);