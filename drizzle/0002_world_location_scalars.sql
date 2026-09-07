DELETE FROM "world"."hunt_spawns";--> statement-breakpoint
DELETE FROM "world"."areas";--> statement-breakpoint
DELETE FROM "catalog"."bots";--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ALTER COLUMN "id" SET DATA TYPE integer USING "id"::integer;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "hunt_nick" text NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "hunt_swf" text NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "hunt_scale" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "hunt_fps" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "hunt_speed" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "hunt_avatar" text NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "hunt_kind" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "hunt_hide_on_map" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "region_map" text NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "ftime_max" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "code" text NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "context" text NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "sound_intro" text NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "sound_bg" text NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "inst_artikul_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "have_trade_channel" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "have_kind_channel" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "hide_finished_fights" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "hide_running_fights" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "no_clan_chat" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD COLUMN "hunt_mask" text NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_hunt_scale_check" CHECK ("catalog"."bots"."hunt_scale" > 0);--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_hunt_fps_check" CHECK ("catalog"."bots"."hunt_fps" > 0);--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_hunt_speed_check" CHECK ("catalog"."bots"."hunt_speed" >= 0);--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_hunt_kind_check" CHECK ("catalog"."bots"."hunt_kind" >= 0);--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_hunt_hide_on_map_check" CHECK ("catalog"."bots"."hunt_hide_on_map" IN (0, 1));--> statement-breakpoint
ALTER TABLE "world"."areas" ADD CONSTRAINT "areas_ftime_max_check" CHECK ("world"."areas"."ftime_max" >= 0);--> statement-breakpoint
ALTER TABLE "world"."areas" ADD CONSTRAINT "areas_inst_artikul_id_check" CHECK ("world"."areas"."inst_artikul_id" >= 0);--> statement-breakpoint
ALTER TABLE "world"."areas" ADD CONSTRAINT "areas_have_trade_channel_check" CHECK ("world"."areas"."have_trade_channel" IN (0, 1));--> statement-breakpoint
ALTER TABLE "world"."areas" ADD CONSTRAINT "areas_have_kind_channel_check" CHECK ("world"."areas"."have_kind_channel" IN (0, 1));--> statement-breakpoint
ALTER TABLE "world"."areas" ADD CONSTRAINT "areas_hide_finished_fights_check" CHECK ("world"."areas"."hide_finished_fights" IN (0, 1));--> statement-breakpoint
ALTER TABLE "world"."areas" ADD CONSTRAINT "areas_hide_running_fights_check" CHECK ("world"."areas"."hide_running_fights" IN (0, 1));--> statement-breakpoint
ALTER TABLE "world"."areas" ADD CONSTRAINT "areas_no_clan_chat_check" CHECK ("world"."areas"."no_clan_chat" IN (0, 1));--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_id_check" CHECK ("world"."hunt_spawns"."id" > 0);