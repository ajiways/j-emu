ALTER TABLE "world"."hunt_spawns" ADD COLUMN "wait_min" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD COLUMN "wait_max" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD COLUMN "respawn_time_min" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD COLUMN "respawn_time_max" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD COLUMN "zone" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD COLUMN "route" jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_wait_min_check" CHECK ("world"."hunt_spawns"."wait_min" >= 0);--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_wait_max_check" CHECK ("world"."hunt_spawns"."wait_max" >= "world"."hunt_spawns"."wait_min");--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_respawn_time_min_check" CHECK ("world"."hunt_spawns"."respawn_time_min" >= 0);--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_respawn_time_max_check" CHECK ("world"."hunt_spawns"."respawn_time_max" >= "world"."hunt_spawns"."respawn_time_min");--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_zone_array_check" CHECK (jsonb_typeof("world"."hunt_spawns"."zone") = 'array');--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_route_array_check" CHECK (jsonb_typeof("world"."hunt_spawns"."route") = 'array');