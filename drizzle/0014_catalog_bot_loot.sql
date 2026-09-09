CREATE TABLE "catalog"."bot_loot_entries" (
	"release_id" uuid NOT NULL,
	"bot_id" integer NOT NULL,
	"artikul_id" integer NOT NULL,
	"drop_weight" integer NOT NULL,
	"count_min" integer NOT NULL,
	"count_max" integer NOT NULL,
	CONSTRAINT "bot_loot_entries_release_id_bot_id_artikul_id_pk" PRIMARY KEY("release_id","bot_id","artikul_id"),
	CONSTRAINT "bot_loot_entries_drop_weight_check" CHECK ("catalog"."bot_loot_entries"."drop_weight" >= 0),
	CONSTRAINT "bot_loot_entries_count_min_check" CHECK ("catalog"."bot_loot_entries"."count_min" >= 1),
	CONSTRAINT "bot_loot_entries_count_max_check" CHECK ("catalog"."bot_loot_entries"."count_max" >= "catalog"."bot_loot_entries"."count_min")
);
--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "base_exp" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "money_min" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "money_max" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "loot_drop_cnt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "loot_bonus_chance" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "loot_bonus_min" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "loot_bonus_max" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "loot_nothing_weight" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bot_loot_entries" ADD CONSTRAINT "bot_loot_entries_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bot_loot_entries" ADD CONSTRAINT "bot_loot_entries_bot_fk" FOREIGN KEY ("release_id","bot_id") REFERENCES "catalog"."bots"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bot_loot_entries" ADD CONSTRAINT "bot_loot_entries_artifact_fk" FOREIGN KEY ("release_id","artikul_id") REFERENCES "catalog"."artifacts"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_base_exp_check" CHECK ("catalog"."bots"."base_exp" >= 0);--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_money_check" CHECK ("catalog"."bots"."money_min" >= 0 AND "catalog"."bots"."money_max" >= "catalog"."bots"."money_min");--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_loot_drop_cnt_check" CHECK ("catalog"."bots"."loot_drop_cnt" >= 0);--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_loot_bonus_chance_check" CHECK ("catalog"."bots"."loot_bonus_chance" >= 0 AND "catalog"."bots"."loot_bonus_chance" <= 1);--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_loot_bonus_check" CHECK ("catalog"."bots"."loot_bonus_min" >= 0 AND "catalog"."bots"."loot_bonus_max" >= "catalog"."bots"."loot_bonus_min");--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_loot_nothing_weight_check" CHECK ("catalog"."bots"."loot_nothing_weight" >= 0);