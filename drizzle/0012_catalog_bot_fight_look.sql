ALTER TABLE "catalog"."bots" ADD COLUMN "hunt_sk" text;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ADD COLUMN "hunt_body" text;--> statement-breakpoint
UPDATE "catalog"."bots" SET "hunt_sk" = '11' WHERE "id" = 2 AND "hunt_sk" IS NULL;--> statement-breakpoint
UPDATE "catalog"."bots" SET "hunt_body" = '' WHERE "hunt_body" IS NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ALTER COLUMN "hunt_sk" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "catalog"."bots" ALTER COLUMN "hunt_body" SET NOT NULL;
