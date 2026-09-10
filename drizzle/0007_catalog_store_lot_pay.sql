ALTER TABLE "catalog"."store_lots" ADD COLUMN "pay" jsonb;--> statement-breakpoint
-- Existing ECO-01 gold lots have price and no pay document; gold amount equals price.
UPDATE "catalog"."store_lots" SET "pay" = jsonb_build_object('currency', 'gold', 'amount', "price") WHERE "pay" IS NULL;--> statement-breakpoint
ALTER TABLE "catalog"."store_lots" ALTER COLUMN "pay" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."store_lots" ADD COLUMN "requires" jsonb;--> statement-breakpoint
ALTER TABLE "catalog"."store_lots" ADD CONSTRAINT "store_lots_lot_id_check" CHECK ("catalog"."store_lots"."lot_id" > 0);
