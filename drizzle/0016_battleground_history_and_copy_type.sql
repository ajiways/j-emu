CREATE SCHEMA "battleground";
--> statement-breakpoint
CREATE TABLE "catalog"."battleground_leader_groups" (
	"release_id" uuid NOT NULL,
	"type" text NOT NULL,
	"id" integer NOT NULL,
	"group_id" text NOT NULL,
	"min_level" text NOT NULL,
	"max_level" text NOT NULL,
	CONSTRAINT "battleground_leader_groups_release_id_type_id_group_id_pk" PRIMARY KEY("release_id","type","id","group_id"),
	CONSTRAINT "battleground_leader_groups_id_check" CHECK ("catalog"."battleground_leader_groups"."id" > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."battleground_rooms" (
	"release_id" uuid NOT NULL,
	"type" text NOT NULL,
	"id" integer NOT NULL,
	"area_id" text NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"title" text NOT NULL,
	CONSTRAINT "battleground_rooms_release_id_type_id_area_id_pk" PRIMARY KEY("release_id","type","id","area_id"),
	CONSTRAINT "battleground_rooms_id_check" CHECK ("catalog"."battleground_rooms"."id" > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."battlegrounds" (
	"release_id" uuid NOT NULL,
	"type" text NOT NULL,
	"id" integer NOT NULL,
	"title" text NOT NULL,
	"flags" integer NOT NULL,
	"available" smallint NOT NULL,
	"queue_level" text NOT NULL,
	"error" text NOT NULL,
	"playable" smallint NOT NULL,
	"inst_artikul_id" integer NOT NULL,
	"level_min" integer NOT NULL,
	"level_max" integer NOT NULL,
	"return_area_id" text NOT NULL,
	"west_area_id" text NOT NULL,
	"arena_area_id" text NOT NULL,
	"east_area_id" text NOT NULL,
	"invite_ttl_sec" integer NOT NULL,
	"ban_sec" integer NOT NULL,
	"match_duration_sec" integer NOT NULL,
	"max_score" integer NOT NULL,
	"points_per_kill" integer NOT NULL,
	"fight_bg" text NOT NULL,
	"fight_flags" text NOT NULL,
	"map_picture" text NOT NULL,
	"stats_picture" text NOT NULL,
	"description" text NOT NULL,
	"rules" text NOT NULL,
	CONSTRAINT "battlegrounds_release_id_type_id_pk" PRIMARY KEY("release_id","type","id"),
	CONSTRAINT "battlegrounds_id_check" CHECK ("catalog"."battlegrounds"."id" > 0),
	CONSTRAINT "battlegrounds_available_check" CHECK ("catalog"."battlegrounds"."available" IN (0, 1)),
	CONSTRAINT "battlegrounds_playable_check" CHECK ("catalog"."battlegrounds"."playable" IN (0, 1)),
	CONSTRAINT "battlegrounds_flags_check" CHECK ("catalog"."battlegrounds"."flags" >= 0)
);
--> statement-breakpoint
CREATE TABLE "battleground"."finished_matches" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "battleground"."finished_matches_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"copy_id" integer NOT NULL,
	"bg_id" text NOT NULL,
	"bg_type" text NOT NULL,
	"inst_artikul_id" text NOT NULL,
	"title" text NOT NULL,
	"time_start" integer NOT NULL,
	"time_finish" integer NOT NULL,
	"level_min" integer NOT NULL,
	"level_max" integer NOT NULL,
	"max_score" integer NOT NULL,
	"score_league" integer NOT NULL,
	"score_cohort" integer NOT NULL,
	"winner_kind" integer NOT NULL,
	CONSTRAINT "finished_matches_id_check" CHECK ("battleground"."finished_matches"."id" > 0),
	CONSTRAINT "finished_matches_copy_id_check" CHECK ("battleground"."finished_matches"."copy_id" > 0),
	CONSTRAINT "finished_matches_times_check" CHECK ("battleground"."finished_matches"."time_finish" >= "battleground"."finished_matches"."time_start"),
	CONSTRAINT "finished_matches_winner_kind_check" CHECK ("battleground"."finished_matches"."winner_kind" IN (0, 2, 3))
);
--> statement-breakpoint
CREATE TABLE "battleground"."finished_players" (
	"match_id" integer NOT NULL,
	"hero_id" integer NOT NULL,
	"nick" text NOT NULL,
	"level" integer NOT NULL,
	"kind" integer NOT NULL,
	"dmg" integer NOT NULL,
	"exp" integer NOT NULL,
	"honor" integer NOT NULL,
	"honor_bonus" integer NOT NULL,
	"kill_cnt" integer NOT NULL,
	"death_cnt" integer NOT NULL,
	"fatality_cnt" integer NOT NULL,
	"rank" text NOT NULL,
	"return_area_id" text NOT NULL,
	CONSTRAINT "finished_players_match_id_hero_id_pk" PRIMARY KEY("match_id","hero_id"),
	CONSTRAINT "finished_players_hero_id_check" CHECK ("battleground"."finished_players"."hero_id" > 0),
	CONSTRAINT "finished_players_kind_check" CHECK ("battleground"."finished_players"."kind" IN (2, 3))
);
--> statement-breakpoint
ALTER TABLE "content"."drafts" DROP CONSTRAINT "drafts_content_type_check";--> statement-breakpoint
ALTER TABLE "instance"."copies" DROP CONSTRAINT "copies_copy_type_check";--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "bg_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."battlegrounds" ADD CONSTRAINT "battlegrounds_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battleground"."finished_players" ADD CONSTRAINT "finished_players_match_id_finished_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "battleground"."finished_matches"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "battleground"."finished_players" ADD CONSTRAINT "finished_players_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "battleground_finished_matches_copy_uidx" ON "battleground"."finished_matches" USING btree ("copy_id");--> statement-breakpoint
ALTER TABLE "content"."drafts" ADD CONSTRAINT "drafts_content_type_check" CHECK ("content"."drafts"."content_type" IN ('artifact', 'bot', 'area', 'area_link', 'hunt_spawn', 'dungeon', 'battleground', 'store_type', 'store_lot', 'reputation_track', 'bonus', 'use_script', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message'));--> statement-breakpoint
ALTER TABLE "instance"."copies" ADD CONSTRAINT "copies_copy_type_check" CHECK ("instance"."copies"."copy_type" IN ('dungeon', 'bg'));