DROP TABLE "combat"."events";--> statement-breakpoint
DROP TABLE "combat"."participants";--> statement-breakpoint
DROP TABLE "combat"."fights";--> statement-breakpoint
CREATE TABLE "combat"."finished_fights" (
	"id" bigint PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"hero_id" uuid NOT NULL,
	"title" text NOT NULL,
	"type" integer NOT NULL,
	"timeout" integer NOT NULL,
	"level_min" integer NOT NULL,
	"level_max" integer NOT NULL,
	"level" integer NOT NULL,
	"ml_title" text NOT NULL,
	"winner" integer NOT NULL,
	"started" text NOT NULL,
	"duration" integer NOT NULL,
	"teams" jsonb NOT NULL,
	"area_id" text NOT NULL,
	"finished_at" timestamp with time zone NOT NULL,
	CONSTRAINT "finished_fights_type_check" CHECK ("combat"."finished_fights"."type" > 0),
	CONSTRAINT "finished_fights_timeout_check" CHECK ("combat"."finished_fights"."timeout" > 0),
	CONSTRAINT "finished_fights_level_min_check" CHECK ("combat"."finished_fights"."level_min" > 0),
	CONSTRAINT "finished_fights_level_max_check" CHECK ("combat"."finished_fights"."level_max" >= "combat"."finished_fights"."level_min"),
	CONSTRAINT "finished_fights_level_check" CHECK ("combat"."finished_fights"."level" >= 0),
	CONSTRAINT "finished_fights_winner_check" CHECK ("combat"."finished_fights"."winner" IN (1, 2)),
	CONSTRAINT "finished_fights_duration_check" CHECK ("combat"."finished_fights"."duration" >= 0)
);
--> statement-breakpoint
ALTER TABLE "combat"."finished_fights" ADD CONSTRAINT "finished_fights_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "identity"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combat"."finished_fights" ADD CONSTRAINT "finished_fights_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "finished_fights_area_finished_idx" ON "combat"."finished_fights" USING btree ("area_id","finished_at");--> statement-breakpoint
CREATE INDEX "finished_fights_account_finished_idx" ON "combat"."finished_fights" USING btree ("account_id","finished_at");--> statement-breakpoint
CREATE INDEX "finished_fights_finished_at_idx" ON "combat"."finished_fights" USING btree ("finished_at");
