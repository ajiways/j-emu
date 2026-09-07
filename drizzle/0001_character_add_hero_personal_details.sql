CREATE TABLE "character"."hero_personal_details" (
	"hero_id" integer PRIMARY KEY NOT NULL,
	"info" jsonb NOT NULL,
	"schema_version" integer NOT NULL,
	CONSTRAINT "hero_personal_details_schema_version_check" CHECK ("character"."hero_personal_details"."schema_version" = 1),
	CONSTRAINT "hero_personal_details_info_object_check" CHECK (jsonb_typeof("character"."hero_personal_details"."info") = 'object'),
	CONSTRAINT "hero_personal_details_info_size_check" CHECK (octet_length("character"."hero_personal_details"."info"::text) <= 16384)
);
--> statement-breakpoint
ALTER TABLE "character"."hero_personal_details" ADD CONSTRAINT "hero_personal_details_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE cascade ON UPDATE no action;