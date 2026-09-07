CREATE SCHEMA "combat";
--> statement-breakpoint
CREATE SEQUENCE "combat"."fight_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 100000 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "combat"."participant_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 200000 CACHE 1;--> statement-breakpoint
CREATE TABLE "combat"."events" (
	"fight_id" bigint NOT NULL,
	"sequence" bigint NOT NULL,
	"event_type" text NOT NULL,
	"event_version" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL,
	CONSTRAINT "events_fight_id_sequence_pk" PRIMARY KEY("fight_id","sequence"),
	CONSTRAINT "events_sequence_check" CHECK ("combat"."events"."sequence" > 0),
	CONSTRAINT "events_event_version_check" CHECK ("combat"."events"."event_version" > 0)
);
--> statement-breakpoint
CREATE TABLE "combat"."fights" (
	"id" bigint PRIMARY KEY NOT NULL,
	"status" text NOT NULL,
	"rules_version" text NOT NULL,
	"arena" text NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "fights_status_check" CHECK ("combat"."fights"."status" IN ('active', 'finished', 'aborted'))
);
--> statement-breakpoint
CREATE TABLE "combat"."participants" (
	"fight_id" bigint NOT NULL,
	"participant_id" bigint NOT NULL,
	"hero_id" uuid,
	"bot_id" integer,
	"team" smallint NOT NULL,
	"hp" integer NOT NULL,
	"max_hp" integer NOT NULL,
	CONSTRAINT "participants_fight_id_participant_id_pk" PRIMARY KEY("fight_id","participant_id"),
	CONSTRAINT "participants_team_check" CHECK ("combat"."participants"."team" IN (1, 2)),
	CONSTRAINT "participants_hp_check" CHECK ("combat"."participants"."hp" >= 0),
	CONSTRAINT "participants_max_hp_check" CHECK ("combat"."participants"."max_hp" > 0),
	CONSTRAINT "participants_actor_check" CHECK (("combat"."participants"."hero_id" IS NULL) <> ("combat"."participants"."bot_id" IS NULL))
);
--> statement-breakpoint
ALTER TABLE "combat"."events" ADD CONSTRAINT "events_fight_id_fights_id_fk" FOREIGN KEY ("fight_id") REFERENCES "combat"."fights"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combat"."participants" ADD CONSTRAINT "participants_fight_id_fights_id_fk" FOREIGN KEY ("fight_id") REFERENCES "combat"."fights"("id") ON DELETE cascade ON UPDATE no action;