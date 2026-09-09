ALTER TABLE "character"."heroes" ADD COLUMN "ghost" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "injury_time" bigint DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "injury_artikul_id" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD CONSTRAINT "heroes_injury_time_check" CHECK ("character"."heroes"."injury_time" >= 0);--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD CONSTRAINT "heroes_injury_artikul_id_check" CHECK ("character"."heroes"."injury_artikul_id" >= 0);