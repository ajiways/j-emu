CREATE TABLE "character"."hero_bot_kills" (
	"hero_id" integer NOT NULL,
	"bot_id" integer NOT NULL,
	"win_cnt" integer NOT NULL,
	CONSTRAINT "hero_bot_kills_hero_id_bot_id_pk" PRIMARY KEY("hero_id","bot_id"),
	CONSTRAINT "hero_bot_kills_hero_id_check" CHECK ("character"."hero_bot_kills"."hero_id" > 0),
	CONSTRAINT "hero_bot_kills_bot_id_check" CHECK ("character"."hero_bot_kills"."bot_id" > 0),
	CONSTRAINT "hero_bot_kills_win_cnt_check" CHECK ("character"."hero_bot_kills"."win_cnt" > 0)
);
--> statement-breakpoint
ALTER TABLE "character"."hero_bot_kills" ADD CONSTRAINT "hero_bot_kills_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;