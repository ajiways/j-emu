ALTER TABLE "character"."heroes" ADD COLUMN "mp_time" bigint;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "mp_regen_at" timestamp with time zone;--> statement-breakpoint
UPDATE "character"."heroes" SET "mp_time" = 0, "mp_regen_at" = "regen_at";--> statement-breakpoint
ALTER TABLE "character"."heroes" ALTER COLUMN "mp_time" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ALTER COLUMN "mp_regen_at" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD CONSTRAINT "heroes_mp_time_check" CHECK ("character"."heroes"."mp_time" >= 0);--> statement-breakpoint
-- Heroes made before mana regeneration get the starter MPREG that new heroes are created with.
INSERT INTO "character"."hero_skills" ("hero_id", "skill_id", "value") SELECT "id", 'MPREG', 100 FROM "character"."heroes" ON CONFLICT DO NOTHING;
