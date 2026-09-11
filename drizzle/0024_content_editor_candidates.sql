CREATE TABLE "content"."candidate_entries" (
	"candidate_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"content_key" text NOT NULL,
	"draft_version_id" uuid NOT NULL,
	CONSTRAINT "candidate_entries_candidate_id_content_type_content_key_pk" PRIMARY KEY("candidate_id","content_type","content_key"),
	CONSTRAINT "candidate_entries_content_type_check" CHECK ("content"."candidate_entries"."content_type" IN ('artifact', 'bot', 'area', 'area_link', 'hunt_spawn', 'dungeon', 'battleground', 'store_type', 'store_lot', 'reputation_track', 'profession', 'assistant_type', 'farm_resource', 'area_farm', 'craft_recipe', 'npc', 'quest', 'world_fact', 'bonus', 'use_script', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message'))
);
--> statement-breakpoint
CREATE TABLE "content"."candidates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expected_active_release_id" uuid NOT NULL,
	"status" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "candidates_status_check" CHECK ("content"."candidates"."status" IN ('open', 'validated', 'invalid', 'activated')),
	CONSTRAINT "candidates_created_by_check" CHECK ("content"."candidates"."created_by" <> '')
);
--> statement-breakpoint
CREATE TABLE "content"."publication_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"release_id" uuid NOT NULL,
	"candidate_id" uuid NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "publication_audits_created_by_check" CHECK ("content"."publication_audits"."created_by" <> '')
);
--> statement-breakpoint
CREATE TABLE "content"."validation_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"candidate_id" uuid NOT NULL,
	"validator_version" text NOT NULL,
	"ok" smallint NOT NULL,
	"issues" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "validation_reports_ok_check" CHECK ("content"."validation_reports"."ok" IN (0, 1)),
	CONSTRAINT "validation_reports_issues_size_check" CHECK (octet_length("content"."validation_reports"."issues"::text) <= 1048576)
);
--> statement-breakpoint
ALTER TABLE "content"."draft_versions" ADD COLUMN "created_by" text;--> statement-breakpoint
UPDATE "content"."draft_versions" SET "created_by" = 'bootstrap';--> statement-breakpoint
ALTER TABLE "content"."draft_versions" ALTER COLUMN "created_by" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "content"."candidate_entries" ADD CONSTRAINT "candidate_entries_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "content"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."candidate_entries" ADD CONSTRAINT "candidate_entries_draft_version_id_draft_versions_id_fk" FOREIGN KEY ("draft_version_id") REFERENCES "content"."draft_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."candidates" ADD CONSTRAINT "candidates_expected_active_release_id_releases_id_fk" FOREIGN KEY ("expected_active_release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."publication_audits" ADD CONSTRAINT "publication_audits_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."publication_audits" ADD CONSTRAINT "publication_audits_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "content"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."validation_reports" ADD CONSTRAINT "validation_reports_candidate_id_candidates_id_fk" FOREIGN KEY ("candidate_id") REFERENCES "content"."candidates"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."draft_versions" ADD CONSTRAINT "draft_versions_created_by_check" CHECK ("content"."draft_versions"."created_by" <> '');