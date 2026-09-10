ALTER TABLE "auction"."listings" DROP CONSTRAINT "listings_kind_check";--> statement-breakpoint
ALTER TABLE "auction"."listings" DROP CONSTRAINT "listings_amount_check";--> statement-breakpoint
ALTER TABLE "auction"."listings" DROP CONSTRAINT "listings_original_item_id_check";--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD COLUMN "whole_stack_only" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD COLUMN "required_durability" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD COLUMN "required_durability_max" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD COLUMN "magic_id" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD COLUMN "required_upgrade_id" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "auction"."listings" ALTER COLUMN "whole_stack_only" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "auction"."listings" ALTER COLUMN "required_durability" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "auction"."listings" ALTER COLUMN "required_durability_max" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "auction"."listings" ALTER COLUMN "magic_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "auction"."listings" ALTER COLUMN "required_upgrade_id" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD CONSTRAINT "listings_whole_stack_only_check" CHECK ("auction"."listings"."whole_stack_only" IN (0, 1));--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD CONSTRAINT "listings_required_durability_check" CHECK ("auction"."listings"."required_durability" >= 0);--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD CONSTRAINT "listings_required_durability_max_check" CHECK ("auction"."listings"."required_durability_max" >= 0);--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD CONSTRAINT "listings_magic_id_check" CHECK ("auction"."listings"."magic_id" >= 0);--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD CONSTRAINT "listings_required_upgrade_id_check" CHECK ("auction"."listings"."required_upgrade_id" >= 0);--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD CONSTRAINT "listings_kind_check" CHECK ("auction"."listings"."kind" IN ('lot', 'tender'));--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD CONSTRAINT "listings_amount_check" CHECK (("auction"."listings"."amount" > 0) OR ("auction"."listings"."status" <> 'open'));--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD CONSTRAINT "listings_original_item_id_check" CHECK (("auction"."listings"."original_item_id" > 0) OR ("auction"."listings"."kind" = 'tender'));