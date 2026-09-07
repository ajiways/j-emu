CREATE SCHEMA "character";
--> statement-breakpoint
CREATE TABLE "character"."heroes" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"nick" text NOT NULL,
	"level" integer NOT NULL,
	"hp" integer NOT NULL,
	"max_hp" integer NOT NULL,
	"area_id" text NOT NULL,
	"money_minor" bigint NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "heroes_account_id_unique" UNIQUE("account_id"),
	CONSTRAINT "heroes_level_check" CHECK ("character"."heroes"."level" > 0),
	CONSTRAINT "heroes_hp_check" CHECK ("character"."heroes"."hp" >= 0),
	CONSTRAINT "heroes_max_hp_check" CHECK ("character"."heroes"."max_hp" > 0 AND "character"."heroes"."hp" <= "character"."heroes"."max_hp"),
	CONSTRAINT "heroes_money_minor_check" CHECK ("character"."heroes"."money_minor" >= 0),
	CONSTRAINT "heroes_version_check" CHECK ("character"."heroes"."version" > 0)
);
