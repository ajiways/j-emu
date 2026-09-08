CREATE TABLE "world"."area_links" (
	"release_id" uuid NOT NULL,
	"from_area_id" text NOT NULL,
	"item_id" integer NOT NULL,
	"to_area_id" text NOT NULL,
	"title" text NOT NULL,
	"picture" text NOT NULL,
	"description" text NOT NULL,
	"flags" integer NOT NULL,
	"direction" integer NOT NULL,
	CONSTRAINT "area_links_release_id_from_area_id_item_id_pk" PRIMARY KEY("release_id","from_area_id","item_id"),
	CONSTRAINT "area_links_item_id_check" CHECK ("world"."area_links"."item_id" >= 0),
	CONSTRAINT "area_links_flags_check" CHECK ("world"."area_links"."flags" >= 0),
	CONSTRAINT "area_links_direction_check" CHECK ("world"."area_links"."direction" >= 0)
);
--> statement-breakpoint
ALTER TABLE "world"."areas" ADD COLUMN "parent_id" text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE "content"."drafts" DROP CONSTRAINT "drafts_content_type_check";--> statement-breakpoint
ALTER TABLE "content"."drafts" ADD CONSTRAINT "drafts_content_type_check" CHECK ("content"."drafts"."content_type" IN ('artifact', 'bot', 'area', 'area_link', 'hunt_spawn', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message'));--> statement-breakpoint
ALTER TABLE "world"."area_links" ADD CONSTRAINT "area_links_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."area_links" ADD CONSTRAINT "area_links_from_area_fk" FOREIGN KEY ("release_id","from_area_id") REFERENCES "world"."areas"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."area_links" ADD CONSTRAINT "area_links_to_area_fk" FOREIGN KEY ("release_id","to_area_id") REFERENCES "world"."areas"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "world_area_links_from_idx" ON "world"."area_links" USING btree ("release_id","from_area_id");