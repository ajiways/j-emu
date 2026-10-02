CREATE TABLE "character"."hero_lifetime_stats" (
	"hero_id" integer PRIMARY KEY NOT NULL,
	"wins" integer NOT NULL,
	"losses" integer NOT NULL,
	"duel_wins" integer NOT NULL,
	"max_fight_damage" integer NOT NULL,
	"fatalities" integer NOT NULL,
	"pvp_kills" integer NOT NULL,
	"daily_pvp_kills" integer NOT NULL,
	"daily_cycle_start" bigint NOT NULL,
	CONSTRAINT "hero_lifetime_stats_wins_check" CHECK ("character"."hero_lifetime_stats"."wins" >= 0),
	CONSTRAINT "hero_lifetime_stats_losses_check" CHECK ("character"."hero_lifetime_stats"."losses" >= 0),
	CONSTRAINT "hero_lifetime_stats_duel_wins_check" CHECK ("character"."hero_lifetime_stats"."duel_wins" >= 0),
	CONSTRAINT "hero_lifetime_stats_max_damage_check" CHECK ("character"."hero_lifetime_stats"."max_fight_damage" >= 0),
	CONSTRAINT "hero_lifetime_stats_fatalities_check" CHECK ("character"."hero_lifetime_stats"."fatalities" >= 0),
	CONSTRAINT "hero_lifetime_stats_pvp_kills_check" CHECK ("character"."hero_lifetime_stats"."pvp_kills" >= 0),
	CONSTRAINT "hero_lifetime_stats_daily_kills_check" CHECK ("character"."hero_lifetime_stats"."daily_pvp_kills" >= 0),
	CONSTRAINT "hero_lifetime_stats_cycle_check" CHECK ("character"."hero_lifetime_stats"."daily_cycle_start" >= 0)
);
--> statement-breakpoint
ALTER TABLE "character"."hero_lifetime_stats" ADD CONSTRAINT "hero_lifetime_stats_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE cascade ON UPDATE no action;