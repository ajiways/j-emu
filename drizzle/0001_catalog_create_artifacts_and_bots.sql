CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE TABLE "catalog"."artifacts" (
	"id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"picture" text NOT NULL,
	"type_id" text NOT NULL,
	"kind_id" integer NOT NULL,
	"slot_mask" integer NOT NULL,
	"weight" integer NOT NULL,
	CONSTRAINT "artifacts_weight_check" CHECK ("catalog"."artifacts"."weight" >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."bots" (
	"id" integer PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"level" integer NOT NULL,
	"max_hp" integer NOT NULL,
	"strength" integer NOT NULL,
	CONSTRAINT "bots_level_check" CHECK ("catalog"."bots"."level" > 0),
	CONSTRAINT "bots_max_hp_check" CHECK ("catalog"."bots"."max_hp" > 0),
	CONSTRAINT "bots_strength_check" CHECK ("catalog"."bots"."strength" >= 0)
);
