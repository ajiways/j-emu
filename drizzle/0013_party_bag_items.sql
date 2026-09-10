CREATE TABLE "party"."party_bag_items" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "party"."party_bag_items_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"party_id" integer NOT NULL,
	"artikul_id" integer NOT NULL,
	"cnt" integer NOT NULL,
	"remove_time" integer NOT NULL,
	CONSTRAINT "party_bag_items_id_check" CHECK ("party"."party_bag_items"."id" > 0),
	CONSTRAINT "party_bag_items_artikul_id_check" CHECK ("party"."party_bag_items"."artikul_id" > 0),
	CONSTRAINT "party_bag_items_cnt_check" CHECK ("party"."party_bag_items"."cnt" >= 1),
	CONSTRAINT "party_bag_items_remove_time_check" CHECK ("party"."party_bag_items"."remove_time" >= 0)
);
--> statement-breakpoint
ALTER TABLE "party"."party_bag_items" ADD CONSTRAINT "party_bag_items_party_id_parties_id_fk" FOREIGN KEY ("party_id") REFERENCES "party"."parties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "party_bag_items_party_idx" ON "party"."party_bag_items" USING btree ("party_id");