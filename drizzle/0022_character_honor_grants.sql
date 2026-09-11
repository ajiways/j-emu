CREATE TABLE "character"."honor_grants" (
	"hero_id" integer NOT NULL,
	"operation_id" text NOT NULL,
	"amount" integer NOT NULL,
	"honor_before" integer NOT NULL,
	"honor_after" integer NOT NULL,
	"rank" integer NOT NULL,
	"honor_min" integer NOT NULL,
	"honor_max" integer NOT NULL,
	"honor_status" integer NOT NULL,
	"content_release_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "honor_grants_hero_id_operation_id_pk" PRIMARY KEY("hero_id","operation_id"),
	CONSTRAINT "honor_grants_operation_id_check" CHECK (char_length("character"."honor_grants"."operation_id") BETWEEN 1 AND 128),
	CONSTRAINT "honor_grants_amount_check" CHECK ("character"."honor_grants"."amount" > 0),
	CONSTRAINT "honor_grants_honor_before_check" CHECK ("character"."honor_grants"."honor_before" >= 0),
	CONSTRAINT "honor_grants_honor_after_check" CHECK ("character"."honor_grants"."honor_after" >= "character"."honor_grants"."honor_before"),
	CONSTRAINT "honor_grants_rank_check" CHECK ("character"."honor_grants"."rank" >= 0),
	CONSTRAINT "honor_grants_honor_min_check" CHECK ("character"."honor_grants"."honor_min" >= 0),
	CONSTRAINT "honor_grants_honor_max_check" CHECK ("character"."honor_grants"."honor_max" >= "character"."honor_grants"."honor_min"),
	CONSTRAINT "honor_grants_honor_status_check" CHECK ("character"."honor_grants"."honor_status" IN (0, 1))
);
--> statement-breakpoint
ALTER TABLE "character"."honor_grants" ADD CONSTRAINT "honor_grants_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character"."honor_grants" ADD CONSTRAINT "honor_grants_content_release_id_releases_id_fk" FOREIGN KEY ("content_release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;