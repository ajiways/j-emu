CREATE TABLE "catalog"."bonuses" (
	"release_id" uuid NOT NULL,
	"id" integer NOT NULL,
	"kind" text NOT NULL,
	"skill_id" text NOT NULL,
	"delta" integer NOT NULL,
	"need_value" integer NOT NULL,
	"artikul_id" integer NOT NULL,
	"title" text NOT NULL,
	"chat_msg" text NOT NULL,
	CONSTRAINT "bonuses_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "bonuses_id_check" CHECK ("catalog"."bonuses"."id" > 0),
	CONSTRAINT "bonuses_kind_check" CHECK ("catalog"."bonuses"."kind" = 'skill'),
	CONSTRAINT "bonuses_delta_check" CHECK ("catalog"."bonuses"."delta" <> 0),
	CONSTRAINT "bonuses_need_value_check" CHECK ("catalog"."bonuses"."need_value" >= 0),
	CONSTRAINT "bonuses_artikul_id_check" CHECK ("catalog"."bonuses"."artikul_id" > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."use_scripts" (
	"release_id" uuid NOT NULL,
	"bonus_id" integer NOT NULL,
	"fail_plaque" text NOT NULL,
	"require" jsonb NOT NULL,
	"effects" jsonb NOT NULL,
	CONSTRAINT "use_scripts_release_id_bonus_id_pk" PRIMARY KEY("release_id","bonus_id"),
	CONSTRAINT "use_scripts_bonus_id_check" CHECK ("catalog"."use_scripts"."bonus_id" > 0)
);
--> statement-breakpoint
CREATE TABLE "character"."hero_learned_bonuses" (
	"hero_id" integer NOT NULL,
	"bonus_id" integer NOT NULL,
	"artikul_id" integer NOT NULL,
	CONSTRAINT "hero_learned_bonuses_hero_id_bonus_id_pk" PRIMARY KEY("hero_id","bonus_id"),
	CONSTRAINT "hero_learned_bonuses_bonus_id_check" CHECK ("character"."hero_learned_bonuses"."bonus_id" > 0),
	CONSTRAINT "hero_learned_bonuses_artikul_id_check" CHECK ("character"."hero_learned_bonuses"."artikul_id" > 0)
);
--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD COLUMN "expire" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bonuses" ADD CONSTRAINT "bonuses_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bonuses" ADD CONSTRAINT "bonuses_skill_fk" FOREIGN KEY ("release_id","skill_id") REFERENCES "catalog"."skill_definitions"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bonuses" ADD CONSTRAINT "bonuses_artifact_fk" FOREIGN KEY ("release_id","artikul_id") REFERENCES "catalog"."artifacts"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."use_scripts" ADD CONSTRAINT "use_scripts_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character"."hero_learned_bonuses" ADD CONSTRAINT "hero_learned_bonuses_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_expire_check" CHECK ("inventory"."items"."expire" >= 0);