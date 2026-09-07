ALTER SEQUENCE "inventory"."item_id_seq" MINVALUE 1000000000 MAXVALUE 2147483647 NO CYCLE;
--> statement-breakpoint
ALTER SEQUENCE "combat"."fight_id_seq" NO CYCLE;
--> statement-breakpoint
ALTER SEQUENCE "combat"."participant_id_seq" NO CYCLE;
--> statement-breakpoint
ALTER TABLE "identity"."accounts" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "character"."heroes" ALTER COLUMN "id" SET DEFAULT gen_random_uuid();
--> statement-breakpoint
ALTER TABLE "inventory"."items" ALTER COLUMN "id" SET DEFAULT nextval('inventory.item_id_seq'::regclass);
