CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE SCHEMA "content";
--> statement-breakpoint
CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE SCHEMA "world";
--> statement-breakpoint
CREATE SCHEMA "character";
--> statement-breakpoint
CREATE SCHEMA "inventory";
--> statement-breakpoint
CREATE SCHEMA "combat";
--> statement-breakpoint
CREATE SEQUENCE "content"."release_version_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "inventory"."item_id_seq" INCREMENT BY 1 MINVALUE 100000 MAXVALUE 2147483647 START WITH 100000 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "combat"."fight_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "identity"."accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "identity"."accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
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
CREATE TABLE "content"."active_release" (
	"lock_id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"release_id" uuid,
	"activated_at" timestamp with time zone,
	CONSTRAINT "active_release_singleton" CHECK ("content"."active_release"."lock_id" = 1)
);
--> statement-breakpoint
CREATE TABLE "content"."bootstrap_imports" (
	"digest" text PRIMARY KEY NOT NULL,
	"release_id" uuid NOT NULL,
	"source" text NOT NULL,
	"applied_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."draft_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"document" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "draft_versions_draft_id_version_unique" UNIQUE("draft_id","version"),
	CONSTRAINT "draft_versions_version_check" CHECK ("content"."draft_versions"."version" > 0),
	CONSTRAINT "draft_versions_document_size_check" CHECK (octet_length("content"."draft_versions"."document"::text) <= 1048576)
);
--> statement-breakpoint
CREATE TABLE "content"."drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" text NOT NULL,
	"content_key" text NOT NULL,
	CONSTRAINT "drafts_type_key_unique" UNIQUE("content_type","content_key"),
	CONSTRAINT "drafts_content_type_check" CHECK ("content"."drafts"."content_type" IN ('artifact', 'bot', 'area', 'hunt_spawn'))
);
--> statement-breakpoint
CREATE TABLE "content"."release_entries" (
	"release_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"content_key" text NOT NULL,
	"draft_version_id" uuid NOT NULL,
	"digest" text NOT NULL,
	CONSTRAINT "release_entries_release_id_content_type_content_key_pk" PRIMARY KEY("release_id","content_type","content_key")
);
--> statement-breakpoint
CREATE TABLE "content"."releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT nextval('content.release_version_seq'::regclass) NOT NULL,
	"checksum" text NOT NULL,
	"schema_version" text NOT NULL,
	"validator_version" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"activated_at" timestamp with time zone,
	CONSTRAINT "releases_version_unique" UNIQUE("version"),
	CONSTRAINT "releases_checksum_unique" UNIQUE("checksum")
);
--> statement-breakpoint
CREATE TABLE "catalog"."artifacts" (
	"release_id" uuid NOT NULL,
	"id" integer NOT NULL,
	"title" text NOT NULL,
	"picture" text NOT NULL,
	"type_id" text NOT NULL,
	"kind_id" integer NOT NULL,
	"slot_mask" integer NOT NULL,
	"weight" integer NOT NULL,
	CONSTRAINT "artifacts_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "artifacts_weight_check" CHECK ("catalog"."artifacts"."weight" >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."bots" (
	"release_id" uuid NOT NULL,
	"id" integer NOT NULL,
	"title" text NOT NULL,
	"level" integer NOT NULL,
	"max_hp" integer NOT NULL,
	"strength" integer NOT NULL,
	CONSTRAINT "bots_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "bots_level_check" CHECK ("catalog"."bots"."level" > 0),
	CONSTRAINT "bots_max_hp_check" CHECK ("catalog"."bots"."max_hp" > 0),
	CONSTRAINT "bots_strength_check" CHECK ("catalog"."bots"."strength" >= 0)
);
--> statement-breakpoint
CREATE TABLE "world"."areas" (
	"release_id" uuid NOT NULL,
	"id" text NOT NULL,
	"title" text NOT NULL,
	"map_asset" text NOT NULL,
	"fight_background" text NOT NULL,
	CONSTRAINT "areas_release_id_id_pk" PRIMARY KEY("release_id","id")
);
--> statement-breakpoint
CREATE TABLE "world"."hunt_spawns" (
	"release_id" uuid NOT NULL,
	"id" text NOT NULL,
	"area_id" text NOT NULL,
	"bot_id" integer NOT NULL,
	"position_x" double precision NOT NULL,
	"position_y" double precision NOT NULL,
	CONSTRAINT "hunt_spawns_release_id_id_pk" PRIMARY KEY("release_id","id")
);
--> statement-breakpoint
CREATE TABLE "character"."heroes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "character"."heroes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
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
ALTER TABLE "content"."active_release" ADD CONSTRAINT "active_release_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."bootstrap_imports" ADD CONSTRAINT "bootstrap_imports_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."draft_versions" ADD CONSTRAINT "draft_versions_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "content"."drafts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."release_entries" ADD CONSTRAINT "release_entries_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."release_entries" ADD CONSTRAINT "release_entries_draft_version_id_draft_versions_id_fk" FOREIGN KEY ("draft_version_id") REFERENCES "content"."draft_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD CONSTRAINT "artifacts_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD CONSTRAINT "areas_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_area_fk" FOREIGN KEY ("release_id","area_id") REFERENCES "world"."areas"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_bot_fk" FOREIGN KEY ("release_id","bot_id") REFERENCES "catalog"."bots"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combat"."finished_fights" ADD CONSTRAINT "finished_fights_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "identity"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combat"."finished_fights" ADD CONSTRAINT "finished_fights_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "world_hunt_spawns_area_idx" ON "world"."hunt_spawns" USING btree ("release_id","area_id");--> statement-breakpoint
CREATE INDEX "inventory_items_hero_idx" ON "inventory"."items" USING btree ("hero_id");--> statement-breakpoint
CREATE INDEX "finished_fights_area_finished_idx" ON "combat"."finished_fights" USING btree ("area_id","finished_at");--> statement-breakpoint
CREATE INDEX "finished_fights_account_finished_idx" ON "combat"."finished_fights" USING btree ("account_id","finished_at");--> statement-breakpoint
CREATE INDEX "finished_fights_finished_at_idx" ON "combat"."finished_fights" USING btree ("finished_at");--> statement-breakpoint
INSERT INTO "content"."active_release" ("lock_id") VALUES (1);