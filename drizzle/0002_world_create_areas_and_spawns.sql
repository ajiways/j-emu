CREATE SCHEMA "world";
--> statement-breakpoint
CREATE TABLE "world"."areas" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"map_asset" text NOT NULL,
	"fight_background" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "world"."hunt_spawns" (
	"id" text PRIMARY KEY NOT NULL,
	"area_id" text NOT NULL,
	"bot_id" integer NOT NULL,
	"position_x" double precision NOT NULL,
	"position_y" double precision NOT NULL,
	CONSTRAINT "hunt_spawns_area_id_id_unique" UNIQUE("area_id","id")
);
--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_area_id_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "world"."areas"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "world_hunt_spawns_area_idx" ON "world"."hunt_spawns" USING btree ("area_id");