CREATE TABLE "catalog"."professions" (
	"release_id" uuid NOT NULL,
	"id" integer NOT NULL,
	"title" text NOT NULL,
	"type" integer NOT NULL,
	"skill_id" text NOT NULL,
	"picture" text NOT NULL,
	"position" integer NOT NULL,
	"skill_step_override" integer,
	"skill_minlvl_override" integer,
	"description" text NOT NULL,
	"info_url" text NOT NULL,
	"user_stat_id" integer,
	CONSTRAINT "professions_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "professions_id_check" CHECK ("catalog"."professions"."id" >= 1 AND "catalog"."professions"."id" <= 16),
	CONSTRAINT "professions_type_check" CHECK ("catalog"."professions"."type" IN (1, 2)),
	CONSTRAINT "professions_position_check" CHECK ("catalog"."professions"."position" > 0)
);
--> statement-breakpoint
CREATE TABLE "character"."hero_professions" (
	"hero_id" integer NOT NULL,
	"profession_id" integer NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "hero_professions_hero_id_profession_id_pk" PRIMARY KEY("hero_id","profession_id"),
	CONSTRAINT "hero_professions_hero_id_check" CHECK ("character"."hero_professions"."hero_id" > 0),
	CONSTRAINT "hero_professions_profession_id_check" CHECK ("character"."hero_professions"."profession_id" >= 1 AND "character"."hero_professions"."profession_id" <= 16),
	CONSTRAINT "hero_professions_value_check" CHECK ("character"."hero_professions"."value" > 0)
);
--> statement-breakpoint
ALTER TABLE "content"."drafts" DROP CONSTRAINT "drafts_content_type_check";--> statement-breakpoint
ALTER TABLE "catalog"."professions" ADD CONSTRAINT "professions_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character"."hero_professions" ADD CONSTRAINT "hero_professions_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."drafts" ADD CONSTRAINT "drafts_content_type_check" CHECK ("content"."drafts"."content_type" IN ('artifact', 'bot', 'area', 'area_link', 'hunt_spawn', 'dungeon', 'battleground', 'store_type', 'store_lot', 'reputation_track', 'profession', 'bonus', 'use_script', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message'));