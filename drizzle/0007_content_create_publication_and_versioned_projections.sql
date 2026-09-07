CREATE SCHEMA "content";
--> statement-breakpoint
CREATE SEQUENCE "content"."release_version_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1 NO CYCLE;--> statement-breakpoint
CREATE TABLE "content"."drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" text NOT NULL,
	"content_key" text NOT NULL,
	CONSTRAINT "drafts_type_key_unique" UNIQUE("content_type","content_key"),
	CONSTRAINT "drafts_content_type_check" CHECK ("content"."drafts"."content_type" IN ('artifact', 'bot', 'area', 'hunt_spawn'))
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
CREATE TABLE "content"."release_entries" (
	"release_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"content_key" text NOT NULL,
	"draft_version_id" uuid NOT NULL,
	"digest" text NOT NULL,
	CONSTRAINT "release_entries_release_id_content_type_content_key_pk" PRIMARY KEY("release_id","content_type","content_key")
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
ALTER TABLE "content"."draft_versions" ADD CONSTRAINT "draft_versions_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "content"."drafts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."release_entries" ADD CONSTRAINT "release_entries_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."release_entries" ADD CONSTRAINT "release_entries_draft_version_id_draft_versions_id_fk" FOREIGN KEY ("draft_version_id") REFERENCES "content"."draft_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."active_release" ADD CONSTRAINT "active_release_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."bootstrap_imports" ADD CONSTRAINT "bootstrap_imports_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
INSERT INTO "content"."active_release" ("lock_id") VALUES (1);--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" DROP CONSTRAINT "hunt_spawns_area_id_id_unique";--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" DROP CONSTRAINT "hunt_spawns_area_id_areas_id_fk";--> statement-breakpoint
DROP INDEX "world"."world_hunt_spawns_area_idx";--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" DROP CONSTRAINT "artifacts_pkey";--> statement-breakpoint
ALTER TABLE "catalog"."bots" DROP CONSTRAINT "bots_pkey";--> statement-breakpoint
ALTER TABLE "world"."areas" DROP CONSTRAINT "areas_pkey";--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" DROP CONSTRAINT "hunt_spawns_pkey";--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD COLUMN "release_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "release_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "release_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD COLUMN "release_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD CONSTRAINT "artifacts_release_id_id_pk" PRIMARY KEY("release_id","id");--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_release_id_id_pk" PRIMARY KEY("release_id","id");--> statement-breakpoint
ALTER TABLE "world"."areas" ADD CONSTRAINT "areas_release_id_id_pk" PRIMARY KEY("release_id","id");--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_release_id_id_pk" PRIMARY KEY("release_id","id");--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD CONSTRAINT "artifacts_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD CONSTRAINT "areas_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_area_fk" FOREIGN KEY ("release_id","area_id") REFERENCES "world"."areas"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_bot_fk" FOREIGN KEY ("release_id","bot_id") REFERENCES "catalog"."bots"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "world_hunt_spawns_area_idx" ON "world"."hunt_spawns" USING btree ("release_id","area_id");
