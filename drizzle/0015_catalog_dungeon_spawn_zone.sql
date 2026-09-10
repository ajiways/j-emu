CREATE TABLE "catalog"."dungeon_spawn_zones" (
	"release_id" uuid NOT NULL,
	"artikul_id" integer NOT NULL,
	"area_id" text NOT NULL,
	"spawn_key" text NOT NULL,
	"ord" integer NOT NULL,
	"x" integer NOT NULL,
	"y" integer NOT NULL,
	CONSTRAINT "dungeon_spawn_zones_release_id_artikul_id_area_id_spawn_key_ord_pk" PRIMARY KEY("release_id","artikul_id","area_id","spawn_key","ord"),
	CONSTRAINT "dungeon_spawn_zones_artikul_id_check" CHECK ("catalog"."dungeon_spawn_zones"."artikul_id" > 0),
	CONSTRAINT "dungeon_spawn_zones_ord_check" CHECK ("catalog"."dungeon_spawn_zones"."ord" >= 0)
);
