CREATE TABLE "catalog"."store_types" (
	"release_id" uuid NOT NULL,
	"area_id" text NOT NULL,
	"type_id" integer NOT NULL,
	"title" text NOT NULL,
	"ord" integer NOT NULL,
	CONSTRAINT "store_types_release_id_area_id_type_id_pk" PRIMARY KEY("release_id","area_id","type_id")
);
--> statement-breakpoint
CREATE TABLE "catalog"."store_lots" (
	"release_id" uuid NOT NULL,
	"area_id" text NOT NULL,
	"lot_id" integer NOT NULL,
	"artikul_id" integer NOT NULL,
	"type_id" integer NOT NULL,
	"price" integer NOT NULL,
	"ord" integer NOT NULL,
	CONSTRAINT "store_lots_release_id_area_id_lot_id_pk" PRIMARY KEY("release_id","area_id","lot_id"),
	CONSTRAINT "store_lots_artikul_id_check" CHECK ("catalog"."store_lots"."artikul_id" > 0),
	CONSTRAINT "store_lots_price_check" CHECK ("catalog"."store_lots"."price" >= 0)
);
--> statement-breakpoint
ALTER TABLE "catalog"."store_types" ADD CONSTRAINT "store_types_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."store_lots" ADD CONSTRAINT "store_lots_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."store_lots" ADD CONSTRAINT "store_lots_artifact_fk" FOREIGN KEY ("release_id","artikul_id") REFERENCES "catalog"."artifacts"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."store_lots" ADD CONSTRAINT "store_lots_type_fk" FOREIGN KEY ("release_id","area_id","type_id") REFERENCES "catalog"."store_types"("release_id","area_id","type_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."store_types" ADD CONSTRAINT "store_types_area_fk" FOREIGN KEY ("release_id","area_id") REFERENCES "world"."areas"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."drafts" DROP CONSTRAINT "drafts_content_type_check";--> statement-breakpoint
ALTER TABLE "content"."drafts" ADD CONSTRAINT "drafts_content_type_check" CHECK ("content"."drafts"."content_type" IN ('artifact', 'bot', 'area', 'area_link', 'hunt_spawn', 'store_type', 'store_lot', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message'));