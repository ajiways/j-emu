CREATE TABLE "catalog"."dungeon_personal_guaranteed" (
	"release_id" uuid NOT NULL,
	"dungeon_artikul_id" integer NOT NULL,
	"loot_artikul_id" integer NOT NULL,
	CONSTRAINT "dungeon_personal_guaranteed_release_id_dungeon_artikul_id_loot_artikul_id_pk" PRIMARY KEY("release_id","dungeon_artikul_id","loot_artikul_id"),
	CONSTRAINT "dungeon_personal_guaranteed_dungeon_artikul_id_check" CHECK ("catalog"."dungeon_personal_guaranteed"."dungeon_artikul_id" > 0),
	CONSTRAINT "dungeon_personal_guaranteed_loot_artikul_id_check" CHECK ("catalog"."dungeon_personal_guaranteed"."loot_artikul_id" > 0)
);
--> statement-breakpoint
ALTER TABLE "catalog"."dungeons" ADD COLUMN "progress_finish_value" integer;--> statement-breakpoint
ALTER TABLE "catalog"."dungeons" ADD COLUMN "coin_artikul_id" integer;--> statement-breakpoint
ALTER TABLE "catalog"."dungeons" ADD COLUMN "coin_min" integer;--> statement-breakpoint
ALTER TABLE "catalog"."dungeons" ADD COLUMN "coin_max" integer;--> statement-breakpoint
ALTER TABLE "catalog"."dungeons" ADD COLUMN "loot_boss_bot_id" integer;--> statement-breakpoint
ALTER TABLE "catalog"."dungeons" ADD CONSTRAINT "dungeons_progress_finish_value_check" CHECK ("catalog"."dungeons"."progress_finish_value" IS NULL OR "catalog"."dungeons"."progress_finish_value" > 0);--> statement-breakpoint
ALTER TABLE "catalog"."dungeons" ADD CONSTRAINT "dungeons_coin_trio_null_check" CHECK (("catalog"."dungeons"."coin_artikul_id" IS NULL) = ("catalog"."dungeons"."coin_min" IS NULL)
        AND ("catalog"."dungeons"."coin_artikul_id" IS NULL) = ("catalog"."dungeons"."coin_max" IS NULL));--> statement-breakpoint
ALTER TABLE "catalog"."dungeons" ADD CONSTRAINT "dungeons_coin_trio_positive_check" CHECK ("catalog"."dungeons"."coin_artikul_id" IS NULL OR (
        "catalog"."dungeons"."coin_artikul_id" > 0 AND "catalog"."dungeons"."coin_min" > 0
        AND "catalog"."dungeons"."coin_max" >= "catalog"."dungeons"."coin_min"
      ));--> statement-breakpoint
ALTER TABLE "catalog"."dungeons" ADD CONSTRAINT "dungeons_loot_boss_bot_id_check" CHECK ("catalog"."dungeons"."loot_boss_bot_id" IS NULL OR "catalog"."dungeons"."loot_boss_bot_id" > 0);