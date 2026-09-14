ALTER TABLE "catalog"."artifacts" DROP CONSTRAINT "artifacts_durability_range_check";--> statement-breakpoint
ALTER TABLE "inventory"."items" DROP CONSTRAINT "items_durability_range_check";--> statement-breakpoint
ALTER TABLE "mail"."letter_attachments" DROP CONSTRAINT "letter_attachments_durability_range_check";--> statement-breakpoint
ALTER TABLE "trade"."held_items" DROP CONSTRAINT "held_items_durability_range_check";--> statement-breakpoint
ALTER TABLE "auction"."listings" DROP CONSTRAINT "listings_durability_range_check";