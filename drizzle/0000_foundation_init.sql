CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE SCHEMA "content";
--> statement-breakpoint
CREATE SCHEMA "catalog";
--> statement-breakpoint
CREATE SCHEMA "world";
--> statement-breakpoint
CREATE SCHEMA "character";
--> statement-breakpoint
CREATE SCHEMA "inventory";
--> statement-breakpoint
CREATE SCHEMA "combat";
--> statement-breakpoint
CREATE SEQUENCE "content"."release_version_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "inventory"."item_id_seq" INCREMENT BY 1 MINVALUE 100000 MAXVALUE 2147483647 START WITH 100000 CACHE 1;--> statement-breakpoint
CREATE SEQUENCE "combat"."fight_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1;--> statement-breakpoint
CREATE TABLE "identity"."accounts" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "identity"."accounts_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"login" text NOT NULL,
	"nick" text NOT NULL,
	"password_hash" text,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "accounts_login_unique" UNIQUE("login"),
	CONSTRAINT "accounts_nick_unique" UNIQUE("nick")
);
--> statement-breakpoint
CREATE TABLE "identity"."sessions" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"session_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_account_id_unique" UNIQUE("account_id")
);
--> statement-breakpoint
CREATE TABLE "content"."active_release" (
	"lock_id" smallint PRIMARY KEY DEFAULT 1 NOT NULL,
	"release_id" uuid,
	"activated_at" timestamp with time zone,
	CONSTRAINT "active_release_singleton" CHECK ("content"."active_release"."lock_id" = 1)
);
--> statement-breakpoint
CREATE TABLE "content"."bootstrap_imports" (
	"digest" text PRIMARY KEY NOT NULL,
	"release_id" uuid NOT NULL,
	"source" text NOT NULL,
	"applied_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content"."draft_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"draft_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"schema_version" text NOT NULL,
	"document" jsonb NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "draft_versions_draft_id_version_unique" UNIQUE("draft_id","version"),
	CONSTRAINT "draft_versions_version_check" CHECK ("content"."draft_versions"."version" > 0),
	CONSTRAINT "draft_versions_document_size_check" CHECK (octet_length("content"."draft_versions"."document"::text) <= 1048576)
);
--> statement-breakpoint
CREATE TABLE "content"."drafts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"content_type" text NOT NULL,
	"content_key" text NOT NULL,
	CONSTRAINT "drafts_type_key_unique" UNIQUE("content_type","content_key"),
	CONSTRAINT "drafts_content_type_check" CHECK ("content"."drafts"."content_type" IN ('artifact', 'bot', 'area', 'area_link', 'hunt_spawn', 'store_type', 'store_lot', 'reputation_track', 'skill', 'level', 'appearance', 'hud_defaults', 'chrome', 'common_conf', 'welcome_message'))
);
--> statement-breakpoint
CREATE TABLE "content"."release_entries" (
	"release_id" uuid NOT NULL,
	"content_type" text NOT NULL,
	"content_key" text NOT NULL,
	"draft_version_id" uuid NOT NULL,
	"digest" text NOT NULL,
	CONSTRAINT "release_entries_release_id_content_type_content_key_pk" PRIMARY KEY("release_id","content_type","content_key")
);
--> statement-breakpoint
CREATE TABLE "content"."releases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version" integer DEFAULT nextval('content.release_version_seq'::regclass) NOT NULL,
	"checksum" text NOT NULL,
	"schema_version" text NOT NULL,
	"validator_version" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"activated_at" timestamp with time zone,
	CONSTRAINT "releases_version_unique" UNIQUE("version"),
	CONSTRAINT "releases_checksum_unique" UNIQUE("checksum")
);
--> statement-breakpoint
CREATE TABLE "catalog"."appearance_presets" (
	"release_id" uuid NOT NULL,
	"kind" integer NOT NULL,
	"gender" integer NOT NULL,
	"avatar_big" text NOT NULL,
	"avatar_small" text NOT NULL,
	CONSTRAINT "appearance_presets_release_id_kind_gender_pk" PRIMARY KEY("release_id","kind","gender"),
	CONSTRAINT "appearance_presets_kind_check" CHECK ("catalog"."appearance_presets"."kind" > 0),
	CONSTRAINT "appearance_presets_gender_check" CHECK ("catalog"."appearance_presets"."gender" > 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."artifacts" (
	"release_id" uuid NOT NULL,
	"id" integer NOT NULL,
	"title" text NOT NULL,
	"picture" text NOT NULL,
	"type_id" text NOT NULL,
	"kind_id" integer NOT NULL,
	"slot_mask" integer NOT NULL,
	"weight" integer NOT NULL,
	"level_min" integer NOT NULL,
	"level_max" integer NOT NULL,
	"gender" integer NOT NULL,
	"price_minor" integer NOT NULL,
	"flags" integer NOT NULL,
	"bag_stack" integer NOT NULL,
	"durability" integer NOT NULL,
	"durability_max" integer NOT NULL,
	"skills" jsonb NOT NULL,
	"artifact_actions" jsonb NOT NULL,
	"extra" jsonb NOT NULL,
	CONSTRAINT "artifacts_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "artifacts_weight_check" CHECK ("catalog"."artifacts"."weight" >= 0),
	CONSTRAINT "artifacts_level_min_check" CHECK ("catalog"."artifacts"."level_min" >= 0),
	CONSTRAINT "artifacts_level_max_check" CHECK ("catalog"."artifacts"."level_max" >= 0),
	CONSTRAINT "artifacts_gender_check" CHECK ("catalog"."artifacts"."gender" >= 0),
	CONSTRAINT "artifacts_price_minor_check" CHECK ("catalog"."artifacts"."price_minor" >= 0),
	CONSTRAINT "artifacts_flags_check" CHECK ("catalog"."artifacts"."flags" >= 0),
	CONSTRAINT "artifacts_bag_stack_check" CHECK ("catalog"."artifacts"."bag_stack" >= 1),
	CONSTRAINT "artifacts_durability_check" CHECK ("catalog"."artifacts"."durability" >= 0),
	CONSTRAINT "artifacts_durability_max_check" CHECK ("catalog"."artifacts"."durability_max" >= 0),
	CONSTRAINT "artifacts_durability_range_check" CHECK ("catalog"."artifacts"."durability" <= "catalog"."artifacts"."durability_max")
);
--> statement-breakpoint
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
CREATE TABLE "catalog"."bots" (
	"release_id" uuid NOT NULL,
	"id" integer NOT NULL,
	"title" text NOT NULL,
	"level" integer NOT NULL,
	"max_hp" integer NOT NULL,
	"strength" integer NOT NULL,
	"hunt_nick" text NOT NULL,
	"hunt_swf" text NOT NULL,
	"hunt_scale" integer NOT NULL,
	"hunt_fps" integer NOT NULL,
	"hunt_speed" integer NOT NULL,
	"hunt_avatar" text NOT NULL,
	"hunt_kind" integer NOT NULL,
	"hunt_hide_on_map" integer NOT NULL,
	"hunt_sk" text NOT NULL,
	"hunt_body" text NOT NULL,
	"base_exp" integer NOT NULL,
	"money_min" double precision NOT NULL,
	"money_max" double precision NOT NULL,
	"loot_drop_cnt" integer NOT NULL,
	"loot_bonus_chance" double precision NOT NULL,
	"loot_bonus_min" integer NOT NULL,
	"loot_bonus_max" integer NOT NULL,
	"loot_nothing_weight" integer NOT NULL,
	CONSTRAINT "bots_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "bots_level_check" CHECK ("catalog"."bots"."level" > 0),
	CONSTRAINT "bots_max_hp_check" CHECK ("catalog"."bots"."max_hp" > 0),
	CONSTRAINT "bots_strength_check" CHECK ("catalog"."bots"."strength" >= 0),
	CONSTRAINT "bots_hunt_scale_check" CHECK ("catalog"."bots"."hunt_scale" > 0),
	CONSTRAINT "bots_hunt_fps_check" CHECK ("catalog"."bots"."hunt_fps" > 0),
	CONSTRAINT "bots_hunt_speed_check" CHECK ("catalog"."bots"."hunt_speed" >= 0),
	CONSTRAINT "bots_hunt_kind_check" CHECK ("catalog"."bots"."hunt_kind" >= 0),
	CONSTRAINT "bots_hunt_hide_on_map_check" CHECK ("catalog"."bots"."hunt_hide_on_map" IN (0, 1)),
	CONSTRAINT "bots_base_exp_check" CHECK ("catalog"."bots"."base_exp" >= 0),
	CONSTRAINT "bots_money_check" CHECK ("catalog"."bots"."money_min" >= 0 AND "catalog"."bots"."money_max" >= "catalog"."bots"."money_min"),
	CONSTRAINT "bots_loot_drop_cnt_check" CHECK ("catalog"."bots"."loot_drop_cnt" >= 0),
	CONSTRAINT "bots_loot_bonus_chance_check" CHECK ("catalog"."bots"."loot_bonus_chance" >= 0 AND "catalog"."bots"."loot_bonus_chance" <= 1),
	CONSTRAINT "bots_loot_bonus_check" CHECK ("catalog"."bots"."loot_bonus_min" >= 0 AND "catalog"."bots"."loot_bonus_max" >= "catalog"."bots"."loot_bonus_min"),
	CONSTRAINT "bots_loot_nothing_weight_check" CHECK ("catalog"."bots"."loot_nothing_weight" >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."game_wide_documents" (
	"release_id" uuid NOT NULL,
	"document_key" text NOT NULL,
	"document" jsonb NOT NULL,
	CONSTRAINT "game_wide_documents_release_id_document_key_pk" PRIMARY KEY("release_id","document_key"),
	CONSTRAINT "game_wide_documents_key_check" CHECK ("catalog"."game_wide_documents"."document_key" IN ('hud_defaults', 'chrome', 'common_conf', 'welcome_message'))
);
--> statement-breakpoint
CREATE TABLE "catalog"."level_boundaries" (
	"release_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"exp_min" integer NOT NULL,
	"exp_max" integer NOT NULL,
	"bag_cnt" integer NOT NULL,
	"honor_rank" integer NOT NULL,
	"honor_min" integer NOT NULL,
	"honor_max" integer NOT NULL,
	"honor_status" integer NOT NULL,
	CONSTRAINT "level_boundaries_release_id_level_pk" PRIMARY KEY("release_id","level"),
	CONSTRAINT "level_boundaries_level_check" CHECK ("catalog"."level_boundaries"."level" > 0),
	CONSTRAINT "level_boundaries_exp_check" CHECK ("catalog"."level_boundaries"."exp_min" >= 0 AND "catalog"."level_boundaries"."exp_max" > "catalog"."level_boundaries"."exp_min"),
	CONSTRAINT "level_boundaries_bag_cnt_check" CHECK ("catalog"."level_boundaries"."bag_cnt" > 0),
	CONSTRAINT "level_boundaries_honor_check" CHECK ("catalog"."level_boundaries"."honor_rank" >= 0 AND "catalog"."level_boundaries"."honor_min" >= 0 AND "catalog"."level_boundaries"."honor_max" >= "catalog"."level_boundaries"."honor_min" AND "catalog"."level_boundaries"."honor_status" >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."level_skill_values" (
	"release_id" uuid NOT NULL,
	"level" integer NOT NULL,
	"skill_id" text NOT NULL,
	"value" integer NOT NULL,
	"evidence_kind" text NOT NULL,
	"source_digest" text NOT NULL,
	CONSTRAINT "level_skill_values_release_id_level_skill_id_pk" PRIMARY KEY("release_id","level","skill_id"),
	CONSTRAINT "level_skill_values_value_check" CHECK ("catalog"."level_skill_values"."value" >= 0),
	CONSTRAINT "level_skill_values_evidence_kind_check" CHECK ("catalog"."level_skill_values"."evidence_kind" IN ('confirmed', 'legacy_extrapolated')),
	CONSTRAINT "level_skill_values_source_digest_check" CHECK (char_length("catalog"."level_skill_values"."source_digest") = 64)
);
--> statement-breakpoint
CREATE TABLE "catalog"."reputation_tracks" (
	"release_id" uuid NOT NULL,
	"object_id" integer NOT NULL,
	"type" integer NOT NULL,
	"title" text NOT NULL,
	"image" text NOT NULL,
	"unlock_flag" text NOT NULL,
	CONSTRAINT "reputation_tracks_release_id_object_id_pk" PRIMARY KEY("release_id","object_id"),
	CONSTRAINT "reputation_tracks_object_id_check" CHECK ("catalog"."reputation_tracks"."object_id" > 0 AND "catalog"."reputation_tracks"."object_id" <> 36),
	CONSTRAINT "reputation_tracks_type_check" CHECK ("catalog"."reputation_tracks"."type" = 2)
);
--> statement-breakpoint
CREATE TABLE "catalog"."skill_definitions" (
	"release_id" uuid NOT NULL,
	"id" text NOT NULL,
	"title" text NOT NULL,
	"group_key" text NOT NULL,
	"sort_order" text NOT NULL,
	"weight" text NOT NULL,
	"image" text NOT NULL,
	"value_kind" text NOT NULL,
	CONSTRAINT "skill_definitions_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "skill_definitions_value_kind_check" CHECK ("catalog"."skill_definitions"."value_kind" IN ('number', 'string'))
);
--> statement-breakpoint
CREATE TABLE "catalog"."store_lots" (
	"release_id" uuid NOT NULL,
	"area_id" text NOT NULL,
	"lot_id" integer NOT NULL,
	"artikul_id" integer NOT NULL,
	"type_id" integer NOT NULL,
	"price" integer NOT NULL,
	"ord" integer NOT NULL,
	CONSTRAINT "store_lots_release_id_area_id_lot_id_pk" PRIMARY KEY("release_id","area_id","lot_id"),
	CONSTRAINT "store_lots_artikul_id_check" CHECK ("catalog"."store_lots"."artikul_id" > 0),
	CONSTRAINT "store_lots_price_check" CHECK ("catalog"."store_lots"."price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "catalog"."store_types" (
	"release_id" uuid NOT NULL,
	"area_id" text NOT NULL,
	"type_id" integer NOT NULL,
	"title" text NOT NULL,
	"ord" integer NOT NULL,
	CONSTRAINT "store_types_release_id_area_id_type_id_pk" PRIMARY KEY("release_id","area_id","type_id")
);
--> statement-breakpoint
CREATE TABLE "world"."area_links" (
	"release_id" uuid NOT NULL,
	"from_area_id" text NOT NULL,
	"item_id" integer NOT NULL,
	"to_area_id" text NOT NULL,
	"title" text NOT NULL,
	"picture" text NOT NULL,
	"description" text NOT NULL,
	"flags" integer NOT NULL,
	"direction" integer NOT NULL,
	CONSTRAINT "area_links_release_id_from_area_id_item_id_pk" PRIMARY KEY("release_id","from_area_id","item_id"),
	CONSTRAINT "area_links_item_id_check" CHECK ("world"."area_links"."item_id" >= 0),
	CONSTRAINT "area_links_flags_check" CHECK ("world"."area_links"."flags" >= 0),
	CONSTRAINT "area_links_direction_check" CHECK ("world"."area_links"."direction" >= 0)
);
--> statement-breakpoint
CREATE TABLE "world"."areas" (
	"release_id" uuid NOT NULL,
	"id" text NOT NULL,
	"title" text NOT NULL,
	"parent_id" text DEFAULT '' NOT NULL,
	"map_asset" text NOT NULL,
	"fight_background" text NOT NULL,
	"region_map" text NOT NULL,
	"ftime_max" integer NOT NULL,
	"code" text NOT NULL,
	"context" text NOT NULL,
	"sound_intro" text NOT NULL,
	"sound_bg" text NOT NULL,
	"inst_artikul_id" integer NOT NULL,
	"have_trade_channel" integer NOT NULL,
	"have_kind_channel" integer NOT NULL,
	"hide_finished_fights" integer NOT NULL,
	"hide_running_fights" integer NOT NULL,
	"no_clan_chat" integer NOT NULL,
	CONSTRAINT "areas_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "areas_ftime_max_check" CHECK ("world"."areas"."ftime_max" >= 0),
	CONSTRAINT "areas_inst_artikul_id_check" CHECK ("world"."areas"."inst_artikul_id" >= 0),
	CONSTRAINT "areas_have_trade_channel_check" CHECK ("world"."areas"."have_trade_channel" IN (0, 1)),
	CONSTRAINT "areas_have_kind_channel_check" CHECK ("world"."areas"."have_kind_channel" IN (0, 1)),
	CONSTRAINT "areas_hide_finished_fights_check" CHECK ("world"."areas"."hide_finished_fights" IN (0, 1)),
	CONSTRAINT "areas_hide_running_fights_check" CHECK ("world"."areas"."hide_running_fights" IN (0, 1)),
	CONSTRAINT "areas_no_clan_chat_check" CHECK ("world"."areas"."no_clan_chat" IN (0, 1))
);
--> statement-breakpoint
CREATE TABLE "world"."hunt_spawns" (
	"release_id" uuid NOT NULL,
	"id" integer NOT NULL,
	"area_id" text NOT NULL,
	"bot_id" integer NOT NULL,
	"position_x" double precision NOT NULL,
	"position_y" double precision NOT NULL,
	"hunt_mask" text NOT NULL,
	CONSTRAINT "hunt_spawns_release_id_id_pk" PRIMARY KEY("release_id","id"),
	CONSTRAINT "hunt_spawns_id_check" CHECK ("world"."hunt_spawns"."id" > 0)
);
--> statement-breakpoint
CREATE TABLE "character"."experience_grants" (
	"hero_id" integer NOT NULL,
	"operation_id" text NOT NULL,
	"amount" integer NOT NULL,
	"exp_before" integer NOT NULL,
	"exp_after" integer NOT NULL,
	"level_before" integer NOT NULL,
	"level_after" integer NOT NULL,
	"content_release_id" uuid NOT NULL,
	"progression_digest" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "experience_grants_hero_id_operation_id_pk" PRIMARY KEY("hero_id","operation_id"),
	CONSTRAINT "experience_grants_operation_id_check" CHECK (char_length("character"."experience_grants"."operation_id") BETWEEN 1 AND 128),
	CONSTRAINT "experience_grants_amount_check" CHECK ("character"."experience_grants"."amount" > 0),
	CONSTRAINT "experience_grants_exp_before_check" CHECK ("character"."experience_grants"."exp_before" >= 0),
	CONSTRAINT "experience_grants_exp_after_check" CHECK ("character"."experience_grants"."exp_after" >= "character"."experience_grants"."exp_before"),
	CONSTRAINT "experience_grants_level_before_check" CHECK ("character"."experience_grants"."level_before" > 0),
	CONSTRAINT "experience_grants_level_after_check" CHECK ("character"."experience_grants"."level_after" >= "character"."experience_grants"."level_before"),
	CONSTRAINT "experience_grants_progression_digest_check" CHECK (char_length("character"."experience_grants"."progression_digest") = 64)
);
--> statement-breakpoint
CREATE TABLE "character"."hero_personal_details" (
	"hero_id" integer PRIMARY KEY NOT NULL,
	"info" jsonb NOT NULL,
	"schema_version" integer NOT NULL,
	CONSTRAINT "hero_personal_details_schema_version_check" CHECK ("character"."hero_personal_details"."schema_version" = 1),
	CONSTRAINT "hero_personal_details_info_object_check" CHECK (jsonb_typeof("character"."hero_personal_details"."info") = 'object'),
	CONSTRAINT "hero_personal_details_info_size_check" CHECK (octet_length("character"."hero_personal_details"."info"::text) <= 16384)
);
--> statement-breakpoint
CREATE TABLE "character"."hero_reputations" (
	"hero_id" integer NOT NULL,
	"object_id" integer NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "hero_reputations_hero_id_object_id_pk" PRIMARY KEY("hero_id","object_id"),
	CONSTRAINT "hero_reputations_object_id_check" CHECK ("character"."hero_reputations"."object_id" > 0 AND "character"."hero_reputations"."object_id" <> 36),
	CONSTRAINT "hero_reputations_value_check" CHECK ("character"."hero_reputations"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "character"."hero_skills" (
	"hero_id" integer NOT NULL,
	"skill_id" text NOT NULL,
	"value" integer NOT NULL,
	CONSTRAINT "hero_skills_hero_id_skill_id_pk" PRIMARY KEY("hero_id","skill_id"),
	CONSTRAINT "hero_skills_value_check" CHECK ("character"."hero_skills"."value" >= 0)
);
--> statement-breakpoint
CREATE TABLE "character"."heroes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "character"."heroes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"account_id" integer NOT NULL,
	"nick" text NOT NULL,
	"level" integer NOT NULL,
	"hp" integer NOT NULL,
	"max_hp" integer NOT NULL,
	"mp" integer NOT NULL,
	"max_mp" integer NOT NULL,
	"exp" integer NOT NULL,
	"area_id" text NOT NULL,
	"money_minor" bigint NOT NULL,
	"money_gold_minor" bigint NOT NULL,
	"kind" integer NOT NULL,
	"gender" integer NOT NULL,
	"language" text NOT NULL,
	"body" text NOT NULL,
	"sk" integer NOT NULL,
	"honor" integer NOT NULL,
	"hp_time" bigint NOT NULL,
	"regen_at" timestamp with time zone NOT NULL,
	"move_ready_at" timestamp with time zone,
	"ghost" boolean DEFAULT false NOT NULL,
	"injury_time" bigint DEFAULT 0 NOT NULL,
	"injury_artikul_id" integer DEFAULT 0 NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "heroes_account_id_unique" UNIQUE("account_id"),
	CONSTRAINT "heroes_level_check" CHECK ("character"."heroes"."level" > 0),
	CONSTRAINT "heroes_hp_check" CHECK ("character"."heroes"."hp" >= 0),
	CONSTRAINT "heroes_max_hp_check" CHECK ("character"."heroes"."max_hp" > 0 AND "character"."heroes"."hp" <= "character"."heroes"."max_hp"),
	CONSTRAINT "heroes_mp_check" CHECK ("character"."heroes"."mp" >= 0),
	CONSTRAINT "heroes_max_mp_check" CHECK ("character"."heroes"."max_mp" > 0 AND "character"."heroes"."mp" <= "character"."heroes"."max_mp"),
	CONSTRAINT "heroes_exp_check" CHECK ("character"."heroes"."exp" >= 0),
	CONSTRAINT "heroes_money_minor_check" CHECK ("character"."heroes"."money_minor" >= 0),
	CONSTRAINT "heroes_money_gold_minor_check" CHECK ("character"."heroes"."money_gold_minor" >= 0),
	CONSTRAINT "heroes_kind_check" CHECK ("character"."heroes"."kind" > 0),
	CONSTRAINT "heroes_gender_check" CHECK ("character"."heroes"."gender" > 0),
	CONSTRAINT "heroes_sk_check" CHECK ("character"."heroes"."sk" >= 0),
	CONSTRAINT "heroes_honor_check" CHECK ("character"."heroes"."honor" >= 0),
	CONSTRAINT "heroes_hp_time_check" CHECK ("character"."heroes"."hp_time" >= 0),
	CONSTRAINT "heroes_injury_time_check" CHECK ("character"."heroes"."injury_time" >= 0),
	CONSTRAINT "heroes_injury_artikul_id_check" CHECK ("character"."heroes"."injury_artikul_id" >= 0),
	CONSTRAINT "heroes_version_check" CHECK ("character"."heroes"."version" > 0)
);
--> statement-breakpoint
CREATE TABLE "inventory"."items" (
	"id" bigint PRIMARY KEY DEFAULT nextval('inventory.item_id_seq'::regclass) NOT NULL,
	"hero_id" integer NOT NULL,
	"artifact_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"location_kind" text NOT NULL,
	"pocket_position" integer,
	"equipment_slot" integer,
	"durability" integer NOT NULL,
	"durability_max" integer NOT NULL,
	"version" integer NOT NULL,
	CONSTRAINT "items_id_fight_safe" CHECK ("inventory"."items"."id" >= 100000),
	CONSTRAINT "items_quantity_check" CHECK ("inventory"."items"."quantity" > 0),
	CONSTRAINT "items_version_check" CHECK ("inventory"."items"."version" > 0),
	CONSTRAINT "items_durability_check" CHECK ("inventory"."items"."durability" >= 0),
	CONSTRAINT "items_durability_max_check" CHECK ("inventory"."items"."durability_max" >= 0),
	CONSTRAINT "items_durability_range_check" CHECK ("inventory"."items"."durability" <= "inventory"."items"."durability_max"),
	CONSTRAINT "items_location_kind_check" CHECK ("inventory"."items"."location_kind" IN ('bag', 'pocket', 'equipment')),
	CONSTRAINT "items_location_check" CHECK ((
        ("inventory"."items"."location_kind" = 'bag' AND "inventory"."items"."pocket_position" IS NULL AND "inventory"."items"."equipment_slot" IS NULL)
        OR ("inventory"."items"."location_kind" = 'pocket' AND "inventory"."items"."pocket_position" > 0 AND "inventory"."items"."equipment_slot" IS NULL)
        OR ("inventory"."items"."location_kind" = 'equipment' AND "inventory"."items"."equipment_slot" > 0 AND "inventory"."items"."pocket_position" IS NULL)
      ))
);
--> statement-breakpoint
CREATE TABLE "combat"."finished_fights" (
	"id" bigint PRIMARY KEY NOT NULL,
	"account_id" integer NOT NULL,
	"hero_id" integer NOT NULL,
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
	CONSTRAINT "finished_fights_id_check" CHECK ("combat"."finished_fights"."id" > 0),
	CONSTRAINT "finished_fights_type_check" CHECK ("combat"."finished_fights"."type" > 0),
	CONSTRAINT "finished_fights_timeout_check" CHECK ("combat"."finished_fights"."timeout" > 0),
	CONSTRAINT "finished_fights_level_min_check" CHECK ("combat"."finished_fights"."level_min" > 0),
	CONSTRAINT "finished_fights_level_max_check" CHECK ("combat"."finished_fights"."level_max" >= "combat"."finished_fights"."level_min"),
	CONSTRAINT "finished_fights_level_check" CHECK ("combat"."finished_fights"."level" >= 0),
	CONSTRAINT "finished_fights_winner_check" CHECK ("combat"."finished_fights"."winner" IN (1, 2)),
	CONSTRAINT "finished_fights_duration_check" CHECK ("combat"."finished_fights"."duration" >= 0)
);
--> statement-breakpoint
ALTER TABLE "content"."active_release" ADD CONSTRAINT "active_release_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."bootstrap_imports" ADD CONSTRAINT "bootstrap_imports_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."draft_versions" ADD CONSTRAINT "draft_versions_draft_id_drafts_id_fk" FOREIGN KEY ("draft_id") REFERENCES "content"."drafts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."release_entries" ADD CONSTRAINT "release_entries_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content"."release_entries" ADD CONSTRAINT "release_entries_draft_version_id_draft_versions_id_fk" FOREIGN KEY ("draft_version_id") REFERENCES "content"."draft_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."appearance_presets" ADD CONSTRAINT "appearance_presets_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."artifacts" ADD CONSTRAINT "artifacts_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bot_loot_entries" ADD CONSTRAINT "bot_loot_entries_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bot_loot_entries" ADD CONSTRAINT "bot_loot_entries_bot_fk" FOREIGN KEY ("release_id","bot_id") REFERENCES "catalog"."bots"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bot_loot_entries" ADD CONSTRAINT "bot_loot_entries_artifact_fk" FOREIGN KEY ("release_id","artikul_id") REFERENCES "catalog"."artifacts"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD CONSTRAINT "bots_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."game_wide_documents" ADD CONSTRAINT "game_wide_documents_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."level_boundaries" ADD CONSTRAINT "level_boundaries_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."level_skill_values" ADD CONSTRAINT "level_skill_values_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."level_skill_values" ADD CONSTRAINT "level_skill_values_boundary_fk" FOREIGN KEY ("release_id","level") REFERENCES "catalog"."level_boundaries"("release_id","level") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."level_skill_values" ADD CONSTRAINT "level_skill_values_skill_fk" FOREIGN KEY ("release_id","skill_id") REFERENCES "catalog"."skill_definitions"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."reputation_tracks" ADD CONSTRAINT "reputation_tracks_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."skill_definitions" ADD CONSTRAINT "skill_definitions_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."store_lots" ADD CONSTRAINT "store_lots_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."store_lots" ADD CONSTRAINT "store_lots_artifact_fk" FOREIGN KEY ("release_id","artikul_id") REFERENCES "catalog"."artifacts"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."store_lots" ADD CONSTRAINT "store_lots_type_fk" FOREIGN KEY ("release_id","area_id","type_id") REFERENCES "catalog"."store_types"("release_id","area_id","type_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."store_types" ADD CONSTRAINT "store_types_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."area_links" ADD CONSTRAINT "area_links_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."area_links" ADD CONSTRAINT "area_links_from_area_fk" FOREIGN KEY ("release_id","from_area_id") REFERENCES "world"."areas"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."area_links" ADD CONSTRAINT "area_links_to_area_fk" FOREIGN KEY ("release_id","to_area_id") REFERENCES "world"."areas"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."areas" ADD CONSTRAINT "areas_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_area_fk" FOREIGN KEY ("release_id","area_id") REFERENCES "world"."areas"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "world"."hunt_spawns" ADD CONSTRAINT "hunt_spawns_bot_fk" FOREIGN KEY ("release_id","bot_id") REFERENCES "catalog"."bots"("release_id","id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character"."experience_grants" ADD CONSTRAINT "experience_grants_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character"."experience_grants" ADD CONSTRAINT "experience_grants_content_release_id_releases_id_fk" FOREIGN KEY ("content_release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character"."hero_personal_details" ADD CONSTRAINT "hero_personal_details_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character"."hero_reputations" ADD CONSTRAINT "hero_reputations_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "character"."hero_skills" ADD CONSTRAINT "hero_skills_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combat"."finished_fights" ADD CONSTRAINT "finished_fights_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "identity"."accounts"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "combat"."finished_fights" ADD CONSTRAINT "finished_fights_hero_id_heroes_id_fk" FOREIGN KEY ("hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "world_area_links_from_idx" ON "world"."area_links" USING btree ("release_id","from_area_id");--> statement-breakpoint
CREATE INDEX "world_hunt_spawns_area_idx" ON "world"."hunt_spawns" USING btree ("release_id","area_id");--> statement-breakpoint
CREATE INDEX "inventory_items_hero_idx" ON "inventory"."items" USING btree ("hero_id");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_hero_equipment_slot_uidx" ON "inventory"."items" USING btree ("hero_id","equipment_slot") WHERE "inventory"."items"."location_kind" = 'equipment';--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_items_hero_pocket_position_uidx" ON "inventory"."items" USING btree ("hero_id","pocket_position") WHERE "inventory"."items"."location_kind" = 'pocket';--> statement-breakpoint
CREATE INDEX "finished_fights_area_finished_idx" ON "combat"."finished_fights" USING btree ("area_id","finished_at");--> statement-breakpoint
CREATE INDEX "finished_fights_account_finished_idx" ON "combat"."finished_fights" USING btree ("account_id","finished_at");--> statement-breakpoint
CREATE INDEX "finished_fights_finished_at_idx" ON "combat"."finished_fights" USING btree ("finished_at");
--> statement-breakpoint
INSERT INTO "content"."active_release" ("lock_id") VALUES (1);