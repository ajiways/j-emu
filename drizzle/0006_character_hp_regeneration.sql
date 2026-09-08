ALTER TABLE "character"."heroes" ADD COLUMN "regen_at" timestamp with time zone;
UPDATE "character"."heroes" SET "regen_at" = date_trunc('second', now()) WHERE "regen_at" IS NULL;
ALTER TABLE "character"."heroes" ALTER COLUMN "regen_at" SET NOT NULL;
