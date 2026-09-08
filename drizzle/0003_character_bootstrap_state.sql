DELETE FROM "combat"."finished_fights";--> statement-breakpoint
DELETE FROM "inventory"."items";--> statement-breakpoint
DELETE FROM "character"."hero_personal_details";--> statement-breakpoint
DELETE FROM "character"."heroes";--> statement-breakpoint
CREATE TABLE "catalog"."appearance_presets" (
	"release_id" uuid NOT NULL,
	"kind" integer NOT NULL,
	"gender" integer NOT NULL,
	"avatar_big" text NOT NULL,
	"avatar_small" text NOT NULL,
	CONSTRAINT "appearance_presets_release_id_kind_gender_pk" PRIMARY KEY("release_id","kind","gender"),
	CONSTRAINT "appearance_presets_kind_check" CHECK ("catalog"."appearance_presets"."kind" > 0),
	CONSTRAINT "appearance_presets_gender_check" CHECK ("catalog"."appearance_presets"."gender" > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."game_wide_documents" (
	"release_id" uuid NOT NULL,
	"document_key" text NOT NULL,
	"document" jsonb NOT NULL,
	CONSTRAINT "game_wide_documents_release_id_document_key_pk" PRIMARY KEY("release_id","document_key"),
	CONSTRAINT "game_wide_documents_key_check" CHECK ("catalog"."game_wide_documents"."document_key" IN ('hud_defaults', 'chrome', 'common_conf', 'welcome_message'))
);
--> statement-breakpoint
CREATE TABLE "catalog"."level_boundaries" (
	"release_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"exp_min" integer NOT NULL,
	"exp_max" integer NOT NULL,
	"bag_cnt" integer NOT NULL,
	"honor_rank" integer NOT NULL,
	"honor_min" integer NOT NULL,
	"honor_max" integer NOT NULL,
	"honor_status" integer NOT NULL,
	CONSTRAINT "level_boundaries_release_id_level_pk" PRIMARY KEY("release_id","level"),
	CONSTRAINT "level_boundaries_level_check" CHECK ("catalog"."level_boundaries"."level" > 0),
	CONSTRAINT "level_boundaries_exp_check" CHECK ("catalog"."level_boundaries"."exp_min" >= 0 AND "catalog"."level_boundaries"."exp_max" > "catalog"."level_boundaries"."exp_min"),
	CONSTRAINT "level_boundaries_bag_cnt_check" CHECK ("catalog"."level_boundaries"."bag_cnt" > 0),
	CONSTRAINT "level_boundaries_honor_check" CHECK ("catalog"."level_boundaries"."honor_rank" >= 0 AND "catalog"."level_boundaries"."honor_min" >= 0 AND "catalog"."level_boundaries"."honor_max" >= "catalog"."level_boundaries"."honor_min" AND "catalog"."level_boundaries"."honor_status" >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."skill_definitions" (
	"release_id" uuid NOT NULL,
	"id" text NOT NULL,
	"title" text NOT NULL,
	"group_key" text NOT NULL,
	"sort_order" text NOT NULL,
	"weight" text NOT NULL,
	"image" text NOT NULL,
	"value_kind" text NOT NULL,
	CONSTRAINT "skill_definitions_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "skill_definitions_value_kind_check" CHECK ("catalog"."skill_definitions"."value_kind" IN ('number', 'string'))
);
--> statement-breakpoint
CREATE TABLE "character"."hero_skills" (
	"hero_id" integer NOT NULL,
	"skill_id" text NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "hero_skills_hero_id_skill_id_pk" PRIMARY KEY("hero_id","skill_id"),
	CONSTRAINT "hero_skills_value_check" CHECK ("character"."hero_skills"."value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "content"."drafts" DROP CONSTRAINT "drafts_content_type_check";--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "mp" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "max_mp" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "exp" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "money_gold_minor" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "kind" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "gender" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "language" text NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "body" text NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "sk" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "honor" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD COLUMN "hp_time" bigint NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."appearance_presets" ADD CONSTRAINT "appearance_presets_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."game_wide_documents" ADD CONSTRAINT "game_wide_documents_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."level_boundaries" ADD CONSTRAINT "level_boundaries_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."skill_definitions" ADD CONSTRAINT "skill_definitions_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character"."hero_skills" ADD CONSTRAINT "hero_skills_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."drafts" ADD CONSTRAINT "drafts_content_type_check" CHECK ("content"."drafts"."content_type" IN ('artifact', 'bot', 'area', 'hunt_spawn', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message'));--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD CONSTRAINT "heroes_mp_check" CHECK ("character"."heroes"."mp" >= 0);--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD CONSTRAINT "heroes_max_mp_check" CHECK ("character"."heroes"."max_mp" > 0 AND "character"."heroes"."mp" <= "character"."heroes"."max_mp");--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD CONSTRAINT "heroes_exp_check" CHECK ("character"."heroes"."exp" >= 0);--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD CONSTRAINT "heroes_money_gold_minor_check" CHECK ("character"."heroes"."money_gold_minor" >= 0);--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD CONSTRAINT "heroes_kind_check" CHECK ("character"."heroes"."kind" > 0);--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD CONSTRAINT "heroes_gender_check" CHECK ("character"."heroes"."gender" > 0);--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD CONSTRAINT "heroes_sk_check" CHECK ("character"."heroes"."sk" >= 0);--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD CONSTRAINT "heroes_honor_check" CHECK ("character"."heroes"."honor" >= 0);--> statement-breakpoint
ALTER TABLE "character"."heroes" ADD CONSTRAINT "heroes_hp_time_check" CHECK ("character"."heroes"."hp_time" >= 0);