CREATE SCHEMA "professions";
--> statement-breakpoint
CREATE TABLE "catalog"."area_farms" (
	"release_id" uuid NOT NULL,
	"area_id" text NOT NULL,
	"hunt_spot_id" integer NOT NULL,
	"farm_id" integer NOT NULL,
	"tactics" integer NOT NULL,
	"assistant_max" integer NOT NULL,
	"cnt_max" integer NOT NULL,
	"cnt_cooldown" integer NOT NULL,
	CONSTRAINT "area_farms_release_id_area_id_hunt_spot_id_pk" PRIMARY KEY("release_id","area_id","hunt_spot_id"),
	CONSTRAINT "area_farms_hunt_spot_id_check" CHECK ("catalog"."area_farms"."hunt_spot_id" > 0),
	CONSTRAINT "area_farms_farm_id_check" CHECK ("catalog"."area_farms"."farm_id" > 0),
	CONSTRAINT "area_farms_tactics_check" CHECK ("catalog"."area_farms"."tactics" >= 0 AND "catalog"."area_farms"."tactics" <= 2),
	CONSTRAINT "area_farms_assistant_max_check" CHECK ("catalog"."area_farms"."assistant_max" > 0),
	CONSTRAINT "area_farms_cnt_max_check" CHECK ("catalog"."area_farms"."cnt_max" > 0),
	CONSTRAINT "area_farms_cnt_cooldown_check" CHECK ("catalog"."area_farms"."cnt_cooldown" >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."assistant_types" (
	"release_id" uuid NOT NULL,
	"id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"profession" integer NOT NULL,
	"level" integer NOT NULL,
	"quality" integer NOT NULL,
	"next_artikul_id" integer NOT NULL,
	"skill_sum" integer NOT NULL,
	"price" integer NOT NULL,
	"price_type" integer NOT NULL,
	"picture" text NOT NULL,
	"restrictions_xml" text NOT NULL,
	"voodoo_energy" integer NOT NULL,
	CONSTRAINT "assistant_types_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "assistant_types_id_check" CHECK ("catalog"."assistant_types"."id" > 0),
	CONSTRAINT "assistant_types_profession_check" CHECK ("catalog"."assistant_types"."profession" >= 1 AND "catalog"."assistant_types"."profession" <= 16),
	CONSTRAINT "assistant_types_level_check" CHECK ("catalog"."assistant_types"."level" > 0),
	CONSTRAINT "assistant_types_quality_check" CHECK ("catalog"."assistant_types"."quality" >= 0),
	CONSTRAINT "assistant_types_next_artikul_id_check" CHECK ("catalog"."assistant_types"."next_artikul_id" >= 0),
	CONSTRAINT "assistant_types_skill_sum_check" CHECK ("catalog"."assistant_types"."skill_sum" > 0),
	CONSTRAINT "assistant_types_price_check" CHECK ("catalog"."assistant_types"."price" >= 0),
	CONSTRAINT "assistant_types_price_type_check" CHECK ("catalog"."assistant_types"."price_type" > 0),
	CONSTRAINT "assistant_types_voodoo_energy_check" CHECK ("catalog"."assistant_types"."voodoo_energy" >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."farm_resources" (
	"release_id" uuid NOT NULL,
	"id" integer NOT NULL,
	"title" text NOT NULL,
	"type_id" integer NOT NULL,
	"picture" text NOT NULL,
	"swf" text NOT NULL,
	"quality" integer NOT NULL,
	"profession" integer NOT NULL,
	"artifact_artikul_id" integer NOT NULL,
	"mastery_value" integer NOT NULL,
	"mastery_max" integer NOT NULL,
	"farm_time" integer NOT NULL,
	"stamina_drain" integer NOT NULL,
	CONSTRAINT "farm_resources_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "farm_resources_id_check" CHECK ("catalog"."farm_resources"."id" > 0),
	CONSTRAINT "farm_resources_type_id_check" CHECK ("catalog"."farm_resources"."type_id" >= 0),
	CONSTRAINT "farm_resources_quality_check" CHECK ("catalog"."farm_resources"."quality" >= 0),
	CONSTRAINT "farm_resources_profession_check" CHECK ("catalog"."farm_resources"."profession" >= 1 AND "catalog"."farm_resources"."profession" <= 16),
	CONSTRAINT "farm_resources_artifact_artikul_id_check" CHECK ("catalog"."farm_resources"."artifact_artikul_id" > 0),
	CONSTRAINT "farm_resources_mastery_value_check" CHECK ("catalog"."farm_resources"."mastery_value" >= 0),
	CONSTRAINT "farm_resources_mastery_max_check" CHECK ("catalog"."farm_resources"."mastery_max" > 0),
	CONSTRAINT "farm_resources_farm_time_check" CHECK ("catalog"."farm_resources"."farm_time" > 0),
	CONSTRAINT "farm_resources_stamina_drain_check" CHECK ("catalog"."farm_resources"."stamina_drain" > 0)
);
--> statement-breakpoint
CREATE TABLE "professions"."farm_stocks" (
	"area_id" text NOT NULL,
	"hunt_spot_id" integer NOT NULL,
	"farm_id" integer NOT NULL,
	"cnt_current" integer NOT NULL,
	"last_respawn_time" integer NOT NULL,
	"next_respawn_time" integer NOT NULL,
	CONSTRAINT "farm_stocks_area_id_hunt_spot_id_pk" PRIMARY KEY("area_id","hunt_spot_id"),
	CONSTRAINT "farm_stocks_hunt_spot_id_check" CHECK ("professions"."farm_stocks"."hunt_spot_id" > 0),
	CONSTRAINT "farm_stocks_farm_id_check" CHECK ("professions"."farm_stocks"."farm_id" > 0),
	CONSTRAINT "farm_stocks_cnt_current_check" CHECK ("professions"."farm_stocks"."cnt_current" >= 0),
	CONSTRAINT "farm_stocks_last_respawn_time_check" CHECK ("professions"."farm_stocks"."last_respawn_time" >= 0),
	CONSTRAINT "farm_stocks_next_respawn_time_check" CHECK ("professions"."farm_stocks"."next_respawn_time" >= 0)
);
--> statement-breakpoint
CREATE TABLE "professions"."hero_assistants" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "professions"."hero_assistants_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hero_id" integer NOT NULL,
	"artikul_id" integer NOT NULL,
	"nick" text NOT NULL,
	"skill_speed" integer NOT NULL,
	"skill_defence" integer NOT NULL,
	"skill_intellect" integer NOT NULL,
	"tactics" integer NOT NULL,
	"farm_id" integer NOT NULL,
	"area_id" text NOT NULL,
	"ftime" integer NOT NULL,
	"stime" integer NOT NULL,
	"attack_at" integer NOT NULL,
	"stamina" double precision NOT NULL,
	"stamina_reset_time" integer NOT NULL,
	"mastery_value" integer NOT NULL,
	"result_type" integer NOT NULL,
	"result_value" text NOT NULL,
	"flags" integer NOT NULL,
	"cycle_result" text NOT NULL,
	"loot_granted" boolean NOT NULL,
	CONSTRAINT "hero_assistants_hero_id_check" CHECK ("professions"."hero_assistants"."hero_id" > 0),
	CONSTRAINT "hero_assistants_artikul_id_check" CHECK ("professions"."hero_assistants"."artikul_id" > 0),
	CONSTRAINT "hero_assistants_skill_speed_check" CHECK ("professions"."hero_assistants"."skill_speed" >= 0),
	CONSTRAINT "hero_assistants_skill_defence_check" CHECK ("professions"."hero_assistants"."skill_defence" >= 0),
	CONSTRAINT "hero_assistants_skill_intellect_check" CHECK ("professions"."hero_assistants"."skill_intellect" >= 0),
	CONSTRAINT "hero_assistants_tactics_check" CHECK ("professions"."hero_assistants"."tactics" >= 0 AND "professions"."hero_assistants"."tactics" <= 2),
	CONSTRAINT "hero_assistants_farm_id_check" CHECK ("professions"."hero_assistants"."farm_id" >= 0),
	CONSTRAINT "hero_assistants_ftime_check" CHECK ("professions"."hero_assistants"."ftime" >= 0),
	CONSTRAINT "hero_assistants_stime_check" CHECK ("professions"."hero_assistants"."stime" >= 0),
	CONSTRAINT "hero_assistants_attack_at_check" CHECK ("professions"."hero_assistants"."attack_at" >= 0),
	CONSTRAINT "hero_assistants_stamina_check" CHECK ("professions"."hero_assistants"."stamina" >= 0 AND "professions"."hero_assistants"."stamina" <= 100),
	CONSTRAINT "hero_assistants_stamina_reset_time_check" CHECK ("professions"."hero_assistants"."stamina_reset_time" >= 0),
	CONSTRAINT "hero_assistants_mastery_value_check" CHECK ("professions"."hero_assistants"."mastery_value" >= 0),
	CONSTRAINT "hero_assistants_result_type_check" CHECK ("professions"."hero_assistants"."result_type" >= 0),
	CONSTRAINT "hero_assistants_flags_check" CHECK ("professions"."hero_assistants"."flags" >= 0)
);
--> statement-breakpoint
CREATE TABLE "professions"."hero_farm_stats" (
	"hero_id" integer NOT NULL,
	"farm_id" integer NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "hero_farm_stats_hero_id_farm_id_pk" PRIMARY KEY("hero_id","farm_id"),
	CONSTRAINT "hero_farm_stats_hero_id_check" CHECK ("professions"."hero_farm_stats"."hero_id" > 0),
	CONSTRAINT "hero_farm_stats_farm_id_check" CHECK ("professions"."hero_farm_stats"."farm_id" > 0),
	CONSTRAINT "hero_farm_stats_value_check" CHECK ("professions"."hero_farm_stats"."value" > 0)
);
--> statement-breakpoint
ALTER TABLE "content"."drafts" DROP CONSTRAINT "drafts_content_type_check";--> statement-breakpoint
ALTER TABLE "catalog"."area_farms" ADD CONSTRAINT "area_farms_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."assistant_types" ADD CONSTRAINT "assistant_types_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."farm_resources" ADD CONSTRAINT "farm_resources_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professions"."hero_assistants" ADD CONSTRAINT "hero_assistants_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professions"."hero_farm_stats" ADD CONSTRAINT "hero_farm_stats_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."drafts" ADD CONSTRAINT "drafts_content_type_check" CHECK ("content"."drafts"."content_type" IN ('artifact', 'bot', 'area', 'area_link', 'hunt_spawn', 'dungeon', 'battleground', 'store_type', 'store_lot', 'reputation_track', 'profession', 'assistant_type', 'farm_resource', 'area_farm', 'bonus', 'use_script', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message'));