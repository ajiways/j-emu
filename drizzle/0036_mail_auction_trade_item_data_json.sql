ALTER TABLE "mail"."letter_attachments" ADD COLUMN "data_json" jsonb;
UPDATE "mail"."letter_attachments" SET "data_json" = '{}'::jsonb WHERE "data_json" IS NULL;
ALTER TABLE "mail"."letter_attachments" ALTER COLUMN "data_json" SET NOT NULL;
ALTER TABLE "trade"."held_items" ADD COLUMN "data_json" jsonb;
UPDATE "trade"."held_items" SET "data_json" = '{}'::jsonb WHERE "data_json" IS NULL;
ALTER TABLE "trade"."held_items" ALTER COLUMN "data_json" SET NOT NULL;
ALTER TABLE "auction"."listings" ADD COLUMN "data_json" jsonb;
UPDATE "auction"."listings" SET "data_json" = '{}'::jsonb WHERE "data_json" IS NULL;
ALTER TABLE "auction"."listings" ALTER COLUMN "data_json" SET NOT NULL;
