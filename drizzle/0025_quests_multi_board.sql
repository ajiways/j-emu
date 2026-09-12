ALTER TABLE "quests"."quest_script_ops" DROP CONSTRAINT "quest_script_ops_hook_check";--> statement-breakpoint
ALTER TABLE "quests"."quest_script_ops" DROP CONSTRAINT "quest_script_ops_type_check";--> statement-breakpoint
ALTER TABLE "quests"."quests" ADD COLUMN "award_rep_object_id" integer;--> statement-breakpoint
ALTER TABLE "quests"."quests" ADD COLUMN "award_rep_amount" integer;--> statement-breakpoint
ALTER TABLE "quests"."quests" ADD COLUMN "award_rep_cap" integer;--> statement-breakpoint
ALTER TABLE "quests"."npc_quests" ADD COLUMN "active_only" boolean;--> statement-breakpoint
ALTER TABLE "quests"."npc_quests" ADD COLUMN "welcome_message" text;--> statement-breakpoint
UPDATE "quests"."npc_quests" AS n
SET "active_only" = false,
    "welcome_message" = q."welcome_offer"
FROM "quests"."quests" AS q
WHERE n."release_id" = q."release_id" AND n."quest_key" = q."key";--> statement-breakpoint
ALTER TABLE "quests"."npc_quests" ALTER COLUMN "active_only" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "quests"."npc_quests" ALTER COLUMN "welcome_message" SET NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "npc_quests_release_point_uidx" ON "quests"."npc_quests" USING btree ("release_id","point_id");--> statement-breakpoint
ALTER TABLE "quests"."quests" ADD CONSTRAINT "quests_award_rep_check" CHECK ((
        ("quests"."quests"."award_rep_object_id" IS NULL AND "quests"."quests"."award_rep_amount" IS NULL AND "quests"."quests"."award_rep_cap" IS NULL)
        OR (
          "quests"."quests"."award_rep_object_id" > 0
          AND "quests"."quests"."award_rep_amount" > 0
          AND "quests"."quests"."award_rep_cap" >= 0
        )
      ));--> statement-breakpoint
ALTER TABLE "quests"."quest_script_ops" ADD CONSTRAINT "quest_script_ops_hook_check" CHECK ("quests"."quest_script_ops"."hook" in ('dialog','goal_on_finish','reward','on_accept'));--> statement-breakpoint
ALTER TABLE "quests"."quest_script_ops" ADD CONSTRAINT "quest_script_ops_type_check" CHECK ("quests"."quest_script_ops"."type" in ('START_FIGHT','GRANT_ARTIKUL','GRANT_PROFESSION','REMOVE_ARTIKUL','MSG','SET_FLAG','CLEAR_FLAG','BUMP_GOAL','COMPLETE_GOAL','GRANT_AWARDS','JUMP_AREA'));