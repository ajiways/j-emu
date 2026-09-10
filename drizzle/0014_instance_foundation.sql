CREATE SCHEMA "instance";
--> statement-breakpoint
CREATE TABLE "catalog"."dungeon_areas" (
	"release_id" uuid NOT NULL,
	"artikul_id" integer NOT NULL,
	"area_id" text NOT NULL,
	CONSTRAINT "dungeon_areas_release_id_artikul_id_area_id_pk" PRIMARY KEY("release_id","artikul_id","area_id"),
	CONSTRAINT "dungeon_areas_artikul_id_check" CHECK ("catalog"."dungeon_areas"."artikul_id" > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."dungeon_spawn_encounters" (
	"release_id" uuid NOT NULL,
	"artikul_id" integer NOT NULL,
	"area_id" text NOT NULL,
	"spawn_key" text NOT NULL,
	"bot_id" integer NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "dungeon_spawn_encounters_release_id_artikul_id_area_id_spawn_key_bot_id_pk" PRIMARY KEY("release_id","artikul_id","area_id","spawn_key","bot_id"),
	CONSTRAINT "dungeon_spawn_encounters_bot_id_check" CHECK ("catalog"."dungeon_spawn_encounters"."bot_id" > 0),
	CONSTRAINT "dungeon_spawn_encounters_count_check" CHECK ("catalog"."dungeon_spawn_encounters"."count" > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."dungeon_spawn_routes" (
	"release_id" uuid NOT NULL,
	"artikul_id" integer NOT NULL,
	"area_id" text NOT NULL,
	"spawn_key" text NOT NULL,
	"ord" integer NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	"wait_min" integer NOT NULL,
	"wait_max" integer NOT NULL,
	CONSTRAINT "dungeon_spawn_routes_release_id_artikul_id_area_id_spawn_key_ord_pk" PRIMARY KEY("release_id","artikul_id","area_id","spawn_key","ord"),
	CONSTRAINT "dungeon_spawn_routes_ord_check" CHECK ("catalog"."dungeon_spawn_routes"."ord" >= 0),
	CONSTRAINT "dungeon_spawn_routes_wait_check" CHECK ("catalog"."dungeon_spawn_routes"."wait_max" >= "catalog"."dungeon_spawn_routes"."wait_min"),
	CONSTRAINT "dungeon_spawn_routes_wait_min_check" CHECK ("catalog"."dungeon_spawn_routes"."wait_min" >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."dungeon_spawns" (
	"release_id" uuid NOT NULL,
	"artikul_id" integer NOT NULL,
	"area_id" text NOT NULL,
	"spawn_key" text NOT NULL,
	"hunt_bot_id" integer NOT NULL,
	"is_boss" smallint NOT NULL,
	"counts_for_clear" smallint NOT NULL,
	"hunt_mask" text NOT NULL,
	"position_x" integer NOT NULL,
	"position_y" integer NOT NULL,
	"wait_min" integer NOT NULL,
	"wait_max" integer NOT NULL,
	CONSTRAINT "dungeon_spawns_release_id_artikul_id_area_id_spawn_key_pk" PRIMARY KEY("release_id","artikul_id","area_id","spawn_key"),
	CONSTRAINT "dungeon_spawns_hunt_bot_id_check" CHECK ("catalog"."dungeon_spawns"."hunt_bot_id" > 0),
	CONSTRAINT "dungeon_spawns_is_boss_check" CHECK ("catalog"."dungeon_spawns"."is_boss" IN (0, 1)),
	CONSTRAINT "dungeon_spawns_counts_for_clear_check" CHECK ("catalog"."dungeon_spawns"."counts_for_clear" IN (0, 1)),
	CONSTRAINT "dungeon_spawns_wait_check" CHECK ("catalog"."dungeon_spawns"."wait_max" >= "catalog"."dungeon_spawns"."wait_min"),
	CONSTRAINT "dungeon_spawns_wait_min_check" CHECK ("catalog"."dungeon_spawns"."wait_min" >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."dungeons" (
	"release_id" uuid NOT NULL,
	"artikul_id" integer NOT NULL,
	"title" text NOT NULL,
	"start_area_id" text NOT NULL,
	"parent_area_id" text NOT NULL,
	"level_min" integer NOT NULL,
	"duration_sec" integer NOT NULL,
	"img_url" text NOT NULL,
	"has_clear" smallint NOT NULL,
	CONSTRAINT "dungeons_release_id_artikul_id_pk" PRIMARY KEY("release_id","artikul_id"),
	CONSTRAINT "dungeons_artikul_id_check" CHECK ("catalog"."dungeons"."artikul_id" > 0),
	CONSTRAINT "dungeons_level_min_check" CHECK ("catalog"."dungeons"."level_min" > 0),
	CONSTRAINT "dungeons_duration_sec_check" CHECK ("catalog"."dungeons"."duration_sec" > 0),
	CONSTRAINT "dungeons_has_clear_check" CHECK ("catalog"."dungeons"."has_clear" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE "instance"."binds" (
	"hero_id" integer NOT NULL,
	"dungeon_artikul_id" text NOT NULL,
	"copy_id" integer NOT NULL,
	"bound_unix" integer NOT NULL,
	CONSTRAINT "binds_hero_id_dungeon_artikul_id_pk" PRIMARY KEY("hero_id","dungeon_artikul_id"),
	CONSTRAINT "binds_copy_id_check" CHECK ("instance"."binds"."copy_id" > 0),
	CONSTRAINT "binds_bound_unix_check" CHECK ("instance"."binds"."bound_unix" > 0)
);
--> statement-breakpoint
CREATE TABLE "instance"."copies" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "instance"."copies_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"copy_type" text NOT NULL,
	"artikul_id" text NOT NULL,
	"created_unix" integer NOT NULL,
	"expires_unix" integer NOT NULL,
	"pending_kick" integer NOT NULL,
	CONSTRAINT "copies_id_check" CHECK ("instance"."copies"."id" > 0),
	CONSTRAINT "copies_copy_type_check" CHECK ("instance"."copies"."copy_type" = 'dungeon'),
	CONSTRAINT "copies_created_unix_check" CHECK ("instance"."copies"."created_unix" > 0),
	CONSTRAINT "copies_expires_unix_check" CHECK ("instance"."copies"."expires_unix" > "instance"."copies"."created_unix"),
	CONSTRAINT "copies_pending_kick_check" CHECK ("instance"."copies"."pending_kick" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE "instance"."killed_spawns" (
	"copy_id" integer NOT NULL,
	"spawn_key" text NOT NULL,
	CONSTRAINT "killed_spawns_copy_id_spawn_key_pk" PRIMARY KEY("copy_id","spawn_key"),
	CONSTRAINT "killed_spawns_copy_id_check" CHECK ("instance"."killed_spawns"."copy_id" > 0),
	CONSTRAINT "killed_spawns_spawn_key_check" CHECK (char_length("instance"."killed_spawns"."spawn_key") BETWEEN 1 AND 64)
);
--> statement-breakpoint
ALTER TABLE "content"."drafts" DROP CONSTRAINT "drafts_content_type_check";--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "instance_copy_id" integer;--> statement-breakpoint
ALTER TABLE "catalog"."dungeons" ADD CONSTRAINT "dungeons_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instance"."binds" ADD CONSTRAINT "binds_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instance"."binds" ADD CONSTRAINT "binds_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "instance"."copies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "instance"."killed_spawns" ADD CONSTRAINT "killed_spawns_copy_id_copies_id_fk" FOREIGN KEY ("copy_id") REFERENCES "instance"."copies"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "instance_copies_id_uidx" ON "instance"."copies" USING btree ("id");--> statement-breakpoint
ALTER TABLE "content"."drafts" ADD CONSTRAINT "drafts_content_type_check" CHECK ("content"."drafts"."content_type" IN ('artifact', 'bot', 'area', 'area_link', 'hunt_spawn', 'dungeon', 'store_type', 'store_lot', 'reputation_track', 'bonus', 'use_script', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message'));--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD CONSTRAINT "heroes_instance_copy_id_check" CHECK ("character"."heroes"."instance_copy_id" IS NULL OR "character"."heroes"."instance_copy_id" > 0);