CREATE TABLE "catalog"."craft_recipes" (
	"release_id" uuid NOT NULL,
	"id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"artikul_id" integer NOT NULL,
	"type" integer NOT NULL,
	"profession_id" integer NOT NULL,
	"skill_value" integer NOT NULL,
	"max_skill_value" integer NOT NULL,
	"ingredients" jsonb NOT NULL,
	"duration" integer NOT NULL,
	"create_artikul_id" integer NOT NULL,
	"create_artikul_num" integer NOT NULL,
	"create_quality" integer NOT NULL,
	"create_type_id" integer NOT NULL,
	"create_title" text NOT NULL,
	"create_level_min" integer NOT NULL,
	"table_id" integer NOT NULL,
	CONSTRAINT "craft_recipes_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "craft_recipes_id_check" CHECK ("catalog"."craft_recipes"."id" > 0),
	CONSTRAINT "craft_recipes_artikul_id_check" CHECK ("catalog"."craft_recipes"."artikul_id" > 0),
	CONSTRAINT "craft_recipes_type_check" CHECK ("catalog"."craft_recipes"."type" = 1),
	CONSTRAINT "craft_recipes_profession_id_check" CHECK ("catalog"."craft_recipes"."profession_id" >= 1 AND "catalog"."craft_recipes"."profession_id" <= 16),
	CONSTRAINT "craft_recipes_skill_value_check" CHECK ("catalog"."craft_recipes"."skill_value" >= 0),
	CONSTRAINT "craft_recipes_max_skill_value_check" CHECK ("catalog"."craft_recipes"."max_skill_value" > 0),
	CONSTRAINT "craft_recipes_duration_check" CHECK ("catalog"."craft_recipes"."duration" >= 0),
	CONSTRAINT "craft_recipes_create_artikul_id_check" CHECK ("catalog"."craft_recipes"."create_artikul_id" > 0),
	CONSTRAINT "craft_recipes_create_artikul_num_check" CHECK ("catalog"."craft_recipes"."create_artikul_num" > 0),
	CONSTRAINT "craft_recipes_create_quality_check" CHECK ("catalog"."craft_recipes"."create_quality" >= 0),
	CONSTRAINT "craft_recipes_create_type_id_check" CHECK ("catalog"."craft_recipes"."create_type_id" >= 0),
	CONSTRAINT "craft_recipes_create_level_min_check" CHECK ("catalog"."craft_recipes"."create_level_min" >= 0),
	CONSTRAINT "craft_recipes_table_id_check" CHECK ("catalog"."craft_recipes"."table_id" >= 0)
);
--> statement-breakpoint
CREATE TABLE "professions"."hero_recipes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "professions"."hero_recipes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hero_id" integer NOT NULL,
	"recipe_id" integer NOT NULL,
	"ftime" integer NOT NULL,
	"flags" integer NOT NULL,
	CONSTRAINT "hero_recipes_hero_id_check" CHECK ("professions"."hero_recipes"."hero_id" > 0),
	CONSTRAINT "hero_recipes_recipe_id_check" CHECK ("professions"."hero_recipes"."recipe_id" > 0),
	CONSTRAINT "hero_recipes_ftime_check" CHECK ("professions"."hero_recipes"."ftime" >= 0),
	CONSTRAINT "hero_recipes_flags_check" CHECK ("professions"."hero_recipes"."flags" >= 0)
);
--> statement-breakpoint
ALTER TABLE "content"."drafts" DROP CONSTRAINT "drafts_content_type_check";--> statement-breakpoint
ALTER TABLE "catalog"."craft_recipes" ADD CONSTRAINT "craft_recipes_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "professions"."hero_recipes" ADD CONSTRAINT "hero_recipes_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "craft_recipes_release_artikul_uidx" ON "catalog"."craft_recipes" USING btree ("release_id","artikul_id");--> statement-breakpoint
CREATE UNIQUE INDEX "hero_recipes_hero_recipe_uidx" ON "professions"."hero_recipes" USING btree ("hero_id","recipe_id");--> statement-breakpoint
ALTER TABLE "content"."drafts" ADD CONSTRAINT "drafts_content_type_check" CHECK ("content"."drafts"."content_type" IN ('artifact', 'bot', 'area', 'area_link', 'hunt_spawn', 'dungeon', 'battleground', 'store_type', 'store_lot', 'reputation_track', 'profession', 'assistant_type', 'farm_resource', 'area_farm', 'craft_recipe', 'bonus', 'use_script', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message'));