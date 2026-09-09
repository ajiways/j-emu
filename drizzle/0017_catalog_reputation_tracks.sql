CREATE TABLE "catalog"."reputation_tracks" (
	"release_id" uuid NOT NULL,
	"object_id" integer NOT NULL,
	"type" integer NOT NULL,
	"title" text NOT NULL,
	"image" text NOT NULL,
	"unlock_flag" text NOT NULL,
	CONSTRAINT "reputation_tracks_release_id_object_id_pk" PRIMARY KEY("release_id","object_id"),
	CONSTRAINT "reputation_tracks_object_id_check" CHECK ("catalog"."reputation_tracks"."object_id" > 0 AND "catalog"."reputation_tracks"."object_id" <> 36),
	CONSTRAINT "reputation_tracks_type_check" CHECK ("catalog"."reputation_tracks"."type" = 2)
);
--> statement-breakpoint
CREATE TABLE "character"."hero_reputations" (
	"hero_id" integer NOT NULL,
	"object_id" integer NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "hero_reputations_hero_id_object_id_pk" PRIMARY KEY("hero_id","object_id"),
	CONSTRAINT "hero_reputations_object_id_check" CHECK ("character"."hero_reputations"."object_id" > 0 AND "character"."hero_reputations"."object_id" <> 36),
	CONSTRAINT "hero_reputations_value_check" CHECK ("character"."hero_reputations"."value" >= 0)
);
--> statement-breakpoint
ALTER TABLE "catalog"."reputation_tracks" ADD CONSTRAINT "reputation_tracks_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character"."hero_reputations" ADD CONSTRAINT "hero_reputations_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."drafts" DROP CONSTRAINT "drafts_content_type_check";--> statement-breakpoint
ALTER TABLE "content"."drafts" ADD CONSTRAINT "drafts_content_type_check" CHECK ("content"."drafts"."content_type" IN ('artifact', 'bot', 'area', 'area_link', 'hunt_spawn', 'store_type', 'store_lot', 'reputation_track', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message'));
