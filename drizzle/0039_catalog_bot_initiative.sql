-- Releases published before this column carry no mob LUCK: their rows are backfilled with 0
-- (the old behaviour); a new publish writes the real value. The default only serves the backfill.
ALTER TABLE "catalog"."bots" ADD COLUMN "initiative" integer NOT NULL DEFAULT 0;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ALTER COLUMN "initiative" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_initiative_check" CHECK ("catalog"."bots"."initiative" >= 0);
