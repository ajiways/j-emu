ALTER TABLE "inventory"."items" ADD COLUMN "data_json" jsonb;
UPDATE "inventory"."items" SET "data_json" = '{}'::jsonb WHERE "data_json" IS NULL;
ALTER TABLE "inventory"."items" ALTER COLUMN "data_json" SET NOT NULL;
