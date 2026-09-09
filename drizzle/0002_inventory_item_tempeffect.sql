ALTER TABLE "inventory"."items" DROP CONSTRAINT "items_quantity_check";--> statement-breakpoint
ALTER TABLE "inventory"."items" DROP CONSTRAINT "items_location_kind_check";--> statement-breakpoint
ALTER TABLE "inventory"."items" DROP CONSTRAINT "items_location_check";--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_quantity_check" CHECK ((
        ("inventory"."items"."location_kind" <> 'tempeffect' AND "inventory"."items"."quantity" > 0)
        OR ("inventory"."items"."location_kind" = 'tempeffect' AND "inventory"."items"."quantity" = 0)
      ));--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_location_kind_check" CHECK ("inventory"."items"."location_kind" IN ('bag', 'pocket', 'equipment', 'tempeffect'));--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_location_check" CHECK ((
        ("inventory"."items"."location_kind" = 'bag' AND "inventory"."items"."pocket_position" IS NULL AND "inventory"."items"."equipment_slot" IS NULL)
        OR ("inventory"."items"."location_kind" = 'pocket' AND "inventory"."items"."pocket_position" > 0 AND "inventory"."items"."equipment_slot" IS NULL)
        OR ("inventory"."items"."location_kind" = 'equipment' AND "inventory"."items"."equipment_slot" > 0 AND "inventory"."items"."pocket_position" IS NULL)
        OR ("inventory"."items"."location_kind" = 'tempeffect' AND "inventory"."items"."pocket_position" IS NULL AND "inventory"."items"."equipment_slot" IS NULL)
      ));