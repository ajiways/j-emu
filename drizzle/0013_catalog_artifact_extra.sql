ALTER TABLE "catalog"."artifacts" ADD COLUMN "extra" jsonb DEFAULT '{}'::jsonb NOT NULL;
