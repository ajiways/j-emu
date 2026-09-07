ALTER TABLE "combat"."finished_fights" DROP CONSTRAINT "finished_fights_account_id_accounts_id_fk";--> statement-breakpoint
ALTER TABLE "combat"."finished_fights" DROP CONSTRAINT "finished_fights_hero_id_heroes_id_fk";--> statement-breakpoint
DROP TABLE "combat"."finished_fights";--> statement-breakpoint
DROP TABLE "inventory"."items";--> statement-breakpoint
DROP TABLE "character"."heroes";--> statement-breakpoint
DROP TABLE "identity"."sessions";--> statement-breakpoint
DROP TABLE "identity"."accounts";--> statement-breakpoint
CREATE TABLE "identity"."accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "identity"."accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1 NO CYCLE),
	"login" text NOT NULL,
	"nick" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "accounts_login_unique" UNIQUE("login"),
	CONSTRAINT "accounts_nick_unique" UNIQUE("nick")
);
--> statement-breakpoint
CREATE TABLE "identity"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"session_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "character"."heroes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "character"."heroes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1 NO CYCLE),
	"account_id" integer NOT NULL,
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
--> statement-breakpoint
ALTER SEQUENCE "inventory"."item_id_seq" INCREMENT BY 1 MINVALUE 100000 MAXVALUE 2147483647 START WITH 100000 RESTART WITH 100000 CACHE 1 NO CYCLE;--> statement-breakpoint
CREATE TABLE "inventory"."items" (
	"id" bigint PRIMARY KEY DEFAULT nextval('inventory.item_id_seq'::regclass) NOT NULL,
	"hero_id" integer NOT NULL,
	"artifact_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"location_kind" text NOT NULL,
	"pocket_position" integer,
	"equipment_slot" integer,
	"version" integer NOT NULL,
	CONSTRAINT "items_id_fight_safe" CHECK ("inventory"."items"."id" >= 100000),
	CONSTRAINT "items_quantity_check" CHECK ("inventory"."items"."quantity" > 0),
	CONSTRAINT "items_version_check" CHECK ("inventory"."items"."version" > 0),
	CONSTRAINT "items_location_kind_check" CHECK ("inventory"."items"."location_kind" IN ('bag', 'pocket', 'equipment')),
	CONSTRAINT "items_location_check" CHECK ((
        ("inventory"."items"."location_kind" = 'bag' AND "inventory"."items"."pocket_position" IS NULL AND "inventory"."items"."equipment_slot" IS NULL)
        OR ("inventory"."items"."location_kind" = 'pocket' AND "inventory"."items"."pocket_position" > 0 AND "inventory"."items"."equipment_slot" IS NULL)
        OR ("inventory"."items"."location_kind" = 'equipment' AND "inventory"."items"."equipment_slot" > 0 AND "inventory"."items"."pocket_position" IS NULL)
      ))
);
--> statement-breakpoint
CREATE INDEX "inventory_items_hero_idx" ON "inventory"."items" USING btree ("hero_id");--> statement-breakpoint
ALTER SEQUENCE "combat"."fight_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 RESTART WITH 1 CACHE 1 NO CYCLE;--> statement-breakpoint
CREATE TABLE "combat"."finished_fights" (
	"id" bigint PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"hero_id" integer NOT NULL,
	"title" text NOT NULL,
	"type" integer NOT NULL,
	"timeout" integer NOT NULL,
	"level_min" integer NOT NULL,
	"level_max" integer NOT NULL,
	"level" integer NOT NULL,
	"ml_title" text NOT NULL,
	"winner" integer NOT NULL,
	"started" text NOT NULL,
	"duration" integer NOT NULL,
	"teams" jsonb NOT NULL,
	"area_id" text NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	CONSTRAINT "finished_fights_id_check" CHECK ("combat"."finished_fights"."id" > 0),
	CONSTRAINT "finished_fights_type_check" CHECK ("combat"."finished_fights"."type" > 0),
	CONSTRAINT "finished_fights_timeout_check" CHECK ("combat"."finished_fights"."timeout" > 0),
	CONSTRAINT "finished_fights_level_min_check" CHECK ("combat"."finished_fights"."level_min" > 0),
	CONSTRAINT "finished_fights_level_max_check" CHECK ("combat"."finished_fights"."level_max" >= "combat"."finished_fights"."level_min"),
	CONSTRAINT "finished_fights_level_check" CHECK ("combat"."finished_fights"."level" >= 0),
	CONSTRAINT "finished_fights_winner_check" CHECK ("combat"."finished_fights"."winner" IN (1, 2)),
	CONSTRAINT "finished_fights_duration_check" CHECK ("combat"."finished_fights"."duration" >= 0)
);
--> statement-breakpoint
ALTER TABLE "combat"."finished_fights" ADD CONSTRAINT "finished_fights_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "identity"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combat"."finished_fights" ADD CONSTRAINT "finished_fights_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finished_fights_area_finished_idx" ON "combat"."finished_fights" USING btree ("area_id","finished_at");--> statement-breakpoint
CREATE INDEX "finished_fights_account_finished_idx" ON "combat"."finished_fights" USING btree ("account_id","finished_at");--> statement-breakpoint
CREATE INDEX "finished_fights_finished_at_idx" ON "combat"."finished_fights" USING btree ("finished_at");--> statement-breakpoint
DROP SEQUENCE "combat"."participant_id_seq";
