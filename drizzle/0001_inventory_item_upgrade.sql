ALTER TABLE "inventory"."items" ADD COLUMN "upgrade_id" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD COLUMN "upgrade_level" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD COLUMN "upgrade_skill_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD COLUMN "upgrade_bound" integer NOT NULL;--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_upgrade_id_check" CHECK ("inventory"."items"."upgrade_id" >= 0);--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_upgrade_level_check" CHECK ("inventory"."items"."upgrade_level" >= 0 AND "inventory"."items"."upgrade_level" <= 6);--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_upgrade_bound_check" CHECK ("inventory"."items"."upgrade_bound" IN (0, 1));--> statement-breakpoint
ALTER TABLE "inventory"."items" ADD CONSTRAINT "items_upgrade_state_check" CHECK ((
        ("inventory"."items"."upgrade_level" = 0 AND "inventory"."items"."upgrade_id" = 0 AND "inventory"."items"."upgrade_skill_id" = '' AND "inventory"."items"."upgrade_bound" = 0)
        OR ("inventory"."items"."upgrade_level" > 0 AND "inventory"."items"."upgrade_id" IN (1, 2, 3) AND char_length("inventory"."items"."upgrade_skill_id") > 0)
      ));