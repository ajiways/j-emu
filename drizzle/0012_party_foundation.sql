CREATE SCHEMA "party";
--> statement-breakpoint
CREATE TABLE "party"."parties" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "party"."parties_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"leader_hero_id" integer NOT NULL,
	"loot_rules" text NOT NULL,
	"no_chat" integer NOT NULL,
	"flags" integer NOT NULL,
	"is_search" integer NOT NULL,
	"password" text NOT NULL,
	"instance_artikul_id" text NOT NULL,
	"bot_artikul_id" text NOT NULL,
	"type" text NOT NULL,
	"distribute_ready_at" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "parties_id_check" CHECK ("party"."parties"."id" > 0),
	CONSTRAINT "parties_loot_rules_check" CHECK ("party"."parties"."loot_rules" IN ('1', '2', '3')),
	CONSTRAINT "parties_no_chat_check" CHECK ("party"."parties"."no_chat" IN (0, 1)),
	CONSTRAINT "parties_flags_check" CHECK ("party"."parties"."flags" >= 0),
	CONSTRAINT "parties_is_search_check" CHECK ("party"."parties"."is_search" IN (0, 1)),
	CONSTRAINT "parties_distribute_ready_at_check" CHECK ("party"."parties"."distribute_ready_at" >= 0)
);
--> statement-breakpoint
CREATE TABLE "party"."party_invites" (
	"party_id" integer NOT NULL,
	"target_hero_id" integer NOT NULL,
	"from_hero_id" integer NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "party_invites_party_id_target_hero_id_pk" PRIMARY KEY("party_id","target_hero_id")
);
--> statement-breakpoint
CREATE TABLE "party"."party_members" (
	"party_id" integer NOT NULL,
	"hero_id" integer NOT NULL,
	"account_id" integer NOT NULL,
	"joined_at" timestamp with time zone NOT NULL,
	CONSTRAINT "party_members_party_id_hero_id_pk" PRIMARY KEY("party_id","hero_id"),
	CONSTRAINT "party_members_account_id_check" CHECK ("party"."party_members"."account_id" > 0)
);
--> statement-breakpoint
ALTER TABLE "party"."parties" ADD CONSTRAINT "parties_leader_hero_id_heroes_id_fk" FOREIGN KEY ("leader_hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party"."party_invites" ADD CONSTRAINT "party_invites_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "party"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party"."party_invites" ADD CONSTRAINT "party_invites_target_hero_id_heroes_id_fk" FOREIGN KEY ("target_hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party"."party_invites" ADD CONSTRAINT "party_invites_from_hero_id_heroes_id_fk" FOREIGN KEY ("from_hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party"."party_members" ADD CONSTRAINT "party_members_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "party"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "party"."party_members" ADD CONSTRAINT "party_members_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "party_parties_is_search_idx" ON "party"."parties" USING btree ("is_search");--> statement-breakpoint
CREATE UNIQUE INDEX "party_members_hero_uidx" ON "party"."party_members" USING btree ("hero_id");