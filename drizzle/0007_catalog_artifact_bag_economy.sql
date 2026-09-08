DELETE FROM "catalog"."artifacts";--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD COLUMN "price_minor" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD COLUMN "flags" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD COLUMN "bag_stack" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD CONSTRAINT "artifacts_price_minor_check" CHECK ("catalog"."artifacts"."price_minor" >= 0);--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD CONSTRAINT "artifacts_flags_check" CHECK ("catalog"."artifacts"."flags" >= 0);--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD CONSTRAINT "artifacts_bag_stack_check" CHECK ("catalog"."artifacts"."bag_stack" >= 1);