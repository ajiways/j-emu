CREATE SCHEMA "quests";
--> statement-breakpoint
CREATE TABLE "quests"."hero_facts" (
	"hero_id" integer NOT NULL,
	"fact_id" text NOT NULL,
	"value" text NOT NULL,
	CONSTRAINT "hero_facts_hero_id_fact_id_pk" PRIMARY KEY("hero_id","fact_id"),
	CONSTRAINT "hero_facts_hero_id_check" CHECK ("quests"."hero_facts"."hero_id" > 0)
);
--> statement-breakpoint
CREATE TABLE "quests"."hero_quest_goals" (
	"hero_id" integer NOT NULL,
	"quest_key" text NOT NULL,
	"goal_id" text NOT NULL,
	"goal_ord" integer NOT NULL,
	"done" integer NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "hero_quest_goals_hero_id_quest_key_goal_id_pk" PRIMARY KEY("hero_id","quest_key","goal_id"),
	CONSTRAINT "hero_quest_goals_hero_id_check" CHECK ("quests"."hero_quest_goals"."hero_id" > 0),
	CONSTRAINT "hero_quest_goals_goal_ord_check" CHECK ("quests"."hero_quest_goals"."goal_ord" > 0),
	CONSTRAINT "hero_quest_goals_done_check" CHECK ("quests"."hero_quest_goals"."done" in (0, 1)),
	CONSTRAINT "hero_quest_goals_value_check" CHECK ("quests"."hero_quest_goals"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quests"."hero_quests" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "quests"."hero_quests_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"hero_id" integer NOT NULL,
	"quest_key" text NOT NULL,
	"book_id" integer NOT NULL,
	"status" text NOT NULL,
	"dialog_step" integer NOT NULL,
	"dialog_cursor" text NOT NULL,
	"waiting_action_id" integer,
	"waiting_title" text,
	"waiting_duration_sec" integer,
	"waiting_popup" text,
	"waiting_started_at" timestamp with time zone,
	"started_at" timestamp with time zone NOT NULL,
	"finished_at" timestamp with time zone,
	CONSTRAINT "hero_quests_hero_id_check" CHECK ("quests"."hero_quests"."hero_id" > 0),
	CONSTRAINT "hero_quests_book_id_check" CHECK ("quests"."hero_quests"."book_id" > 0),
	CONSTRAINT "hero_quests_status_check" CHECK ("quests"."hero_quests"."status" in ('active','done')),
	CONSTRAINT "hero_quests_dialog_step_check" CHECK ("quests"."hero_quests"."dialog_step" >= 0),
	CONSTRAINT "hero_quests_waiting_action_id_check" CHECK ("quests"."hero_quests"."waiting_action_id" IS NULL OR "quests"."hero_quests"."waiting_action_id" > 0),
	CONSTRAINT "hero_quests_waiting_duration_sec_check" CHECK ("quests"."hero_quests"."waiting_duration_sec" IS NULL OR "quests"."hero_quests"."waiting_duration_sec" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quests"."quests" (
	"release_id" uuid NOT NULL,
	"key" text NOT NULL,
	"book_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"award_description" text NOT NULL,
	"flags" integer NOT NULL,
	"level_min" integer NOT NULL,
	"level_max" integer NOT NULL,
	"npc_id" integer NOT NULL,
	"point_id" integer NOT NULL,
	"board_ord" integer NOT NULL,
	"welcome_offer" text NOT NULL,
	"welcome_active" text NOT NULL,
	"welcome_ready" text NOT NULL,
	"award_exp" integer NOT NULL,
	"award_money_minor" integer NOT NULL,
	CONSTRAINT "quests_release_id_key_pk" PRIMARY KEY("release_id","key"),
	CONSTRAINT "quests_book_id_check" CHECK ("quests"."quests"."book_id" > 0),
	CONSTRAINT "quests_flags_check" CHECK ("quests"."quests"."flags" >= 0),
	CONSTRAINT "quests_level_min_check" CHECK ("quests"."quests"."level_min" > 0),
	CONSTRAINT "quests_level_max_check" CHECK ("quests"."quests"."level_max" >= 0),
	CONSTRAINT "quests_npc_id_check" CHECK ("quests"."quests"."npc_id" > 0),
	CONSTRAINT "quests_point_id_check" CHECK ("quests"."quests"."point_id" > 0),
	CONSTRAINT "quests_board_ord_check" CHECK ("quests"."quests"."board_ord" > 0),
	CONSTRAINT "quests_award_exp_check" CHECK ("quests"."quests"."award_exp" >= 0),
	CONSTRAINT "quests_award_money_minor_check" CHECK ("quests"."quests"."award_money_minor" >= 0)
);
--> statement-breakpoint
CREATE TABLE "quests"."npc_quests" (
	"release_id" uuid NOT NULL,
	"npc_id" integer NOT NULL,
	"quest_key" text NOT NULL,
	"board_ord" integer NOT NULL,
	"point_id" integer NOT NULL,
	CONSTRAINT "npc_quests_release_id_npc_id_quest_key_pk" PRIMARY KEY("release_id","npc_id","quest_key"),
	CONSTRAINT "npc_quests_npc_id_check" CHECK ("quests"."npc_quests"."npc_id" > 0),
	CONSTRAINT "npc_quests_board_ord_check" CHECK ("quests"."npc_quests"."board_ord" > 0),
	CONSTRAINT "npc_quests_point_id_check" CHECK ("quests"."npc_quests"."point_id" > 0)
);
--> statement-breakpoint
CREATE TABLE "quests"."npcs" (
	"release_id" uuid NOT NULL,
	"id" integer NOT NULL,
	"info_id" integer NOT NULL,
	"title" text NOT NULL,
	"picture" text NOT NULL,
	"description" text NOT NULL,
	"elsetext" text NOT NULL,
	"area_id" text NOT NULL,
	"item_id" integer NOT NULL,
	CONSTRAINT "npcs_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "npcs_id_check" CHECK ("quests"."npcs"."id" > 0),
	CONSTRAINT "npcs_info_id_check" CHECK ("quests"."npcs"."info_id" > 0),
	CONSTRAINT "npcs_item_id_check" CHECK ("quests"."npcs"."item_id" > 0)
);
--> statement-breakpoint
CREATE TABLE "quests"."quest_award_items" (
	"release_id" uuid NOT NULL,
	"quest_key" text NOT NULL,
	"artikul_id" integer NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "quest_award_items_release_id_quest_key_artikul_id_pk" PRIMARY KEY("release_id","quest_key","artikul_id"),
	CONSTRAINT "quest_award_items_artikul_id_check" CHECK ("quests"."quest_award_items"."artikul_id" > 0),
	CONSTRAINT "quest_award_items_count_check" CHECK ("quests"."quest_award_items"."count" > 0)
);
--> statement-breakpoint
CREATE TABLE "quests"."quest_goals" (
	"release_id" uuid NOT NULL,
	"quest_key" text NOT NULL,
	"goal_id" text NOT NULL,
	"kind" text NOT NULL,
	"title" text NOT NULL,
	"goal_ord" integer NOT NULL,
	"limit_value" integer NOT NULL,
	"action_id" integer NOT NULL,
	"object_id" integer NOT NULL,
	"waiting_title" text NOT NULL,
	"waiting_duration_sec" integer NOT NULL,
	"waiting_popup" text NOT NULL,
	CONSTRAINT "quest_goals_release_id_quest_key_goal_id_pk" PRIMARY KEY("release_id","quest_key","goal_id"),
	CONSTRAINT "quest_goals_goal_ord_check" CHECK ("quests"."quest_goals"."goal_ord" > 0),
	CONSTRAINT "quest_goals_limit_value_check" CHECK ("quests"."quest_goals"."limit_value" > 0),
	CONSTRAINT "quest_goals_action_id_check" CHECK ("quests"."quest_goals"."action_id" >= 0),
	CONSTRAINT "quest_goals_object_id_check" CHECK ("quests"."quest_goals"."object_id" >= 0),
	CONSTRAINT "quest_goals_waiting_duration_sec_check" CHECK ("quests"."quest_goals"."waiting_duration_sec" >= 0),
	CONSTRAINT "quest_goals_kind_check" CHECK ("quests"."quest_goals"."kind" in ('talk','kill','loot','buy','equip','deliver','area_action','win_fight'))
);
--> statement-breakpoint
CREATE TABLE "quests"."world_facts" (
	"release_id" uuid NOT NULL,
	"id" text NOT NULL,
	"values" text NOT NULL,
	CONSTRAINT "world_facts_release_id_id_pk" PRIMARY KEY("release_id","id")
);
--> statement-breakpoint
CREATE TABLE "quests"."quest_dialog_steps" (
	"release_id" uuid NOT NULL,
	"quest_key" text NOT NULL,
	"step_ord" integer NOT NULL,
	"type" text NOT NULL,
	"text" text NOT NULL,
	"step_id" text NOT NULL,
	"next_key" text NOT NULL,
	"goal_id" text NOT NULL,
	"answer" text NOT NULL,
	"to_fight" integer NOT NULL,
	CONSTRAINT "quest_dialog_steps_release_id_quest_key_step_ord_pk" PRIMARY KEY("release_id","quest_key","step_ord"),
	CONSTRAINT "quest_dialog_steps_step_ord_check" CHECK ("quests"."quest_dialog_steps"."step_ord" >= 0),
	CONSTRAINT "quest_dialog_steps_to_fight_check" CHECK ("quests"."quest_dialog_steps"."to_fight" in (0, 1)),
	CONSTRAINT "quest_dialog_steps_type_check" CHECK ("quests"."quest_dialog_steps"."type" in ('npc','note','stage','goal','player','reward'))
);
--> statement-breakpoint
CREATE TABLE "quests"."quest_goal_artikuls" (
	"release_id" uuid NOT NULL,
	"quest_key" text NOT NULL,
	"goal_id" text NOT NULL,
	"role" text NOT NULL,
	"artikul_id" integer NOT NULL,
	CONSTRAINT "quest_goal_artikuls_release_id_quest_key_goal_id_role_artikul_id_pk" PRIMARY KEY("release_id","quest_key","goal_id","role","artikul_id"),
	CONSTRAINT "quest_goal_artikuls_artikul_id_check" CHECK ("quests"."quest_goal_artikuls"."artikul_id" > 0),
	CONSTRAINT "quest_goal_artikuls_role_check" CHECK ("quests"."quest_goal_artikuls"."role" in ('kill','buy','equip','loot','deliver','loot_mob'))
);
--> statement-breakpoint
CREATE TABLE "quests"."quest_script_fight_roster" (
	"release_id" uuid NOT NULL,
	"quest_key" text NOT NULL,
	"hook" text NOT NULL,
	"owner_key" text NOT NULL,
	"side" text NOT NULL,
	"ord" integer NOT NULL,
	"artikul_id" integer NOT NULL,
	"count" integer NOT NULL,
	CONSTRAINT "quest_script_fight_roster_release_id_quest_key_hook_owner_key_side_ord_pk" PRIMARY KEY("release_id","quest_key","hook","owner_key","side","ord"),
	CONSTRAINT "quest_script_fight_roster_ord_check" CHECK ("quests"."quest_script_fight_roster"."ord" >= 0),
	CONSTRAINT "quest_script_fight_roster_artikul_id_check" CHECK ("quests"."quest_script_fight_roster"."artikul_id" > 0),
	CONSTRAINT "quest_script_fight_roster_count_check" CHECK ("quests"."quest_script_fight_roster"."count" > 0),
	CONSTRAINT "quest_script_fight_roster_side_check" CHECK ("quests"."quest_script_fight_roster"."side" in ('enemy','ally'))
);
--> statement-breakpoint
CREATE TABLE "quests"."quest_script_ops" (
	"release_id" uuid NOT NULL,
	"quest_key" text NOT NULL,
	"hook" text NOT NULL,
	"owner_key" text NOT NULL,
	"op_ord" integer NOT NULL,
	"type" text NOT NULL,
	"artikul_id" integer,
	"count" integer,
	"profession_id" integer,
	"flag" text,
	"value" text,
	"text" text,
	"goal_id" text,
	"fight_mode" text,
	"chat_start" text,
	"chat_win" text,
	"chat_lose" text,
	CONSTRAINT "quest_script_ops_release_id_quest_key_hook_owner_key_op_ord_pk" PRIMARY KEY("release_id","quest_key","hook","owner_key","op_ord"),
	CONSTRAINT "quest_script_ops_op_ord_check" CHECK ("quests"."quest_script_ops"."op_ord" >= 0),
	CONSTRAINT "quest_script_ops_hook_check" CHECK ("quests"."quest_script_ops"."hook" in ('dialog','goal_on_finish','reward')),
	CONSTRAINT "quest_script_ops_type_check" CHECK ("quests"."quest_script_ops"."type" in ('START_FIGHT','GRANT_ARTIKUL','GRANT_PROFESSION','REMOVE_ARTIKUL','MSG','SET_FLAG','CLEAR_FLAG','BUMP_GOAL','COMPLETE_GOAL','GRANT_AWARDS'))
);
--> statement-breakpoint
ALTER TABLE "quests"."hero_facts" ADD CONSTRAINT "hero_facts_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests"."hero_quest_goals" ADD CONSTRAINT "hero_quest_goals_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests"."hero_quests" ADD CONSTRAINT "hero_quests_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests"."quests" ADD CONSTRAINT "quests_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests"."npc_quests" ADD CONSTRAINT "npc_quests_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests"."npcs" ADD CONSTRAINT "npcs_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests"."quest_award_items" ADD CONSTRAINT "quest_award_items_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests"."quest_goals" ADD CONSTRAINT "quest_goals_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests"."world_facts" ADD CONSTRAINT "world_facts_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests"."quest_dialog_steps" ADD CONSTRAINT "quest_dialog_steps_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests"."quest_goal_artikuls" ADD CONSTRAINT "quest_goal_artikuls_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests"."quest_script_fight_roster" ADD CONSTRAINT "quest_script_fight_roster_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quests"."quest_script_ops" ADD CONSTRAINT "quest_script_ops_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "hero_quests_hero_quest_uidx" ON "quests"."hero_quests" USING btree ("hero_id","quest_key");--> statement-breakpoint
CREATE UNIQUE INDEX "quests_release_book_uidx" ON "quests"."quests" USING btree ("release_id","book_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quests_release_point_uidx" ON "quests"."quests" USING btree ("release_id","point_id");--> statement-breakpoint
CREATE UNIQUE INDEX "npcs_release_area_item_uidx" ON "quests"."npcs" USING btree ("release_id","area_id","item_id");
--> statement-breakpoint
ALTER TABLE "content"."drafts" DROP CONSTRAINT "drafts_content_type_check";--> statement-breakpoint
ALTER TABLE "content"."drafts" ADD CONSTRAINT "drafts_content_type_check" CHECK ("content"."drafts"."content_type" IN ('artifact', 'bot', 'area', 'area_link', 'hunt_spawn', 'dungeon', 'battleground', 'store_type', 'store_lot', 'reputation_track', 'profession', 'assistant_type', 'farm_resource', 'area_farm', 'craft_recipe', 'npc', 'quest', 'world_fact', 'bonus', 'use_script', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message'));