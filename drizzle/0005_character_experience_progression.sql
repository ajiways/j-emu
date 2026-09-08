CREATE TABLE "catalog"."level_skill_values" (
	"release_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"skill_id" text NOT NULL,
	"value" integer NOT NULL,
	"evidence_kind" text NOT NULL,
	"source_digest" text NOT NULL,
	CONSTRAINT "level_skill_values_release_id_level_skill_id_pk" PRIMARY KEY("release_id","level","skill_id"),
	CONSTRAINT "level_skill_values_value_check" CHECK ("catalog"."level_skill_values"."value" >= 0),
	CONSTRAINT "level_skill_values_evidence_kind_check" CHECK ("catalog"."level_skill_values"."evidence_kind" IN ('confirmed', 'legacy_extrapolated')),
	CONSTRAINT "level_skill_values_source_digest_check" CHECK (char_length("catalog"."level_skill_values"."source_digest") = 64)
);
--> statement-breakpoint
CREATE TABLE "character"."experience_grants" (
	"hero_id" integer NOT NULL,
	"operation_id" text NOT NULL,
	"amount" integer NOT NULL,
	"exp_before" integer NOT NULL,
	"exp_after" integer NOT NULL,
	"level_before" integer NOT NULL,
	"level_after" integer NOT NULL,
	"content_release_id" uuid NOT NULL,
	"progression_digest" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "experience_grants_hero_id_operation_id_pk" PRIMARY KEY("hero_id","operation_id"),
	CONSTRAINT "experience_grants_operation_id_check" CHECK (char_length("character"."experience_grants"."operation_id") BETWEEN 1 AND 128),
	CONSTRAINT "experience_grants_amount_check" CHECK ("character"."experience_grants"."amount" > 0),
	CONSTRAINT "experience_grants_exp_before_check" CHECK ("character"."experience_grants"."exp_before" >= 0),
	CONSTRAINT "experience_grants_exp_after_check" CHECK ("character"."experience_grants"."exp_after" >= "character"."experience_grants"."exp_before"),
	CONSTRAINT "experience_grants_level_before_check" CHECK ("character"."experience_grants"."level_before" > 0),
	CONSTRAINT "experience_grants_level_after_check" CHECK ("character"."experience_grants"."level_after" >= "character"."experience_grants"."level_before"),
	CONSTRAINT "experience_grants_progression_digest_check" CHECK (char_length("character"."experience_grants"."progression_digest") = 64)
);
--> statement-breakpoint
ALTER TABLE "catalog"."level_skill_values" ADD CONSTRAINT "level_skill_values_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."level_skill_values" ADD CONSTRAINT "level_skill_values_boundary_fk" FOREIGN KEY ("release_id","level") REFERENCES "catalog"."level_boundaries"("release_id","level") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."level_skill_values" ADD CONSTRAINT "level_skill_values_skill_fk" FOREIGN KEY ("release_id","skill_id") REFERENCES "catalog"."skill_definitions"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character"."experience_grants" ADD CONSTRAINT "experience_grants_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character"."experience_grants" ADD CONSTRAINT "experience_grants_content_release_id_releases_id_fk" FOREIGN KEY ("content_release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;