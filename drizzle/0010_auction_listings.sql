CREATE SCHEMA "auction";
--> statement-breakpoint
CREATE TABLE "auction"."listings" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "auction"."listings_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"kind" text NOT NULL,
	"status" text NOT NULL,
	"owner_hero_id" integer NOT NULL,
	"owner_kind" integer NOT NULL,
	"artikul_id" integer NOT NULL,
	"title" text NOT NULL,
	"kind_id" integer NOT NULL,
	"quality" integer NOT NULL,
	"level_min" integer NOT NULL,
	"amount" integer NOT NULL,
	"start_price_minor" bigint NOT NULL,
	"buyout_minor" bigint NOT NULL,
	"current_bid_minor" bigint NOT NULL,
	"bidder_hero_id" integer,
	"cancel_fee_minor" bigint NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"original_item_id" integer NOT NULL,
	"durability" integer NOT NULL,
	"durability_max" integer NOT NULL,
	"upgrade_id" integer NOT NULL,
	"upgrade_level" integer NOT NULL,
	"upgrade_skill_id" text NOT NULL,
	"upgrade_bound" integer NOT NULL,
	CONSTRAINT "listings_id_check" CHECK ("auction"."listings"."id" > 0),
	CONSTRAINT "listings_kind_check" CHECK ("auction"."listings"."kind" IN ('lot')),
	CONSTRAINT "listings_status_check" CHECK ("auction"."listings"."status" IN ('open', 'sold', 'cancelled', 'expired')),
	CONSTRAINT "listings_owner_kind_check" CHECK ("auction"."listings"."owner_kind" > 0),
	CONSTRAINT "listings_artikul_id_check" CHECK ("auction"."listings"."artikul_id" > 0),
	CONSTRAINT "listings_kind_id_check" CHECK ("auction"."listings"."kind_id" >= 0),
	CONSTRAINT "listings_quality_check" CHECK ("auction"."listings"."quality" >= 0),
	CONSTRAINT "listings_level_min_check" CHECK ("auction"."listings"."level_min" >= 0),
	CONSTRAINT "listings_amount_check" CHECK ("auction"."listings"."amount" > 0),
	CONSTRAINT "listings_start_price_minor_check" CHECK ("auction"."listings"."start_price_minor" >= 0),
	CONSTRAINT "listings_buyout_minor_check" CHECK ("auction"."listings"."buyout_minor" >= 0),
	CONSTRAINT "listings_current_bid_minor_check" CHECK ("auction"."listings"."current_bid_minor" >= 0),
	CONSTRAINT "listings_cancel_fee_minor_check" CHECK ("auction"."listings"."cancel_fee_minor" >= 0),
	CONSTRAINT "listings_original_item_id_check" CHECK ("auction"."listings"."original_item_id" > 0),
	CONSTRAINT "listings_durability_check" CHECK ("auction"."listings"."durability" >= 0),
	CONSTRAINT "listings_durability_max_check" CHECK ("auction"."listings"."durability_max" >= 0),
	CONSTRAINT "listings_durability_range_check" CHECK ("auction"."listings"."durability" <= "auction"."listings"."durability_max"),
	CONSTRAINT "listings_upgrade_id_check" CHECK ("auction"."listings"."upgrade_id" >= 0),
	CONSTRAINT "listings_upgrade_level_check" CHECK ("auction"."listings"."upgrade_level" >= 0 AND "auction"."listings"."upgrade_level" <= 6),
	CONSTRAINT "listings_upgrade_bound_check" CHECK ("auction"."listings"."upgrade_bound" IN (0, 1))
);
--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD CONSTRAINT "listings_owner_hero_id_heroes_id_fk" FOREIGN KEY ("owner_hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auction"."listings" ADD CONSTRAINT "listings_bidder_hero_id_heroes_id_fk" FOREIGN KEY ("bidder_hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auction_listings_status_exp_idx" ON "auction"."listings" USING btree ("status","expires_at");--> statement-breakpoint
CREATE INDEX "auction_listings_kind_status_idx" ON "auction"."listings" USING btree ("kind","status");--> statement-breakpoint
CREATE INDEX "auction_listings_owner_idx" ON "auction"."listings" USING btree ("owner_hero_id");--> statement-breakpoint
CREATE INDEX "auction_listings_bidder_idx" ON "auction"."listings" USING btree ("bidder_hero_id");--> statement-breakpoint
CREATE INDEX "auction_listings_artikul_idx" ON "auction"."listings" USING btree ("artikul_id");