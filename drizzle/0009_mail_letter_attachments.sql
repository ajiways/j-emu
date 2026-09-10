CREATE TABLE "mail"."letter_attachments" (
	"letter_id" integer NOT NULL,
	"ord" integer NOT NULL,
	"original_item_id" integer NOT NULL,
	"artifact_id" integer NOT NULL,
	"quantity" integer NOT NULL,
	"durability" integer NOT NULL,
	"durability_max" integer NOT NULL,
	"upgrade_id" integer NOT NULL,
	"upgrade_level" integer NOT NULL,
	"upgrade_skill_id" text NOT NULL,
	"upgrade_bound" integer NOT NULL,
	CONSTRAINT "letter_attachments_letter_id_ord_pk" PRIMARY KEY("letter_id","ord"),
	CONSTRAINT "letter_attachments_ord_check" CHECK ("mail"."letter_attachments"."ord" >= 0 AND "mail"."letter_attachments"."ord" <= 4),
	CONSTRAINT "letter_attachments_original_item_id_check" CHECK ("mail"."letter_attachments"."original_item_id" > 0),
	CONSTRAINT "letter_attachments_artifact_id_check" CHECK ("mail"."letter_attachments"."artifact_id" > 0),
	CONSTRAINT "letter_attachments_quantity_check" CHECK ("mail"."letter_attachments"."quantity" > 0),
	CONSTRAINT "letter_attachments_durability_check" CHECK ("mail"."letter_attachments"."durability" >= 0),
	CONSTRAINT "letter_attachments_durability_max_check" CHECK ("mail"."letter_attachments"."durability_max" >= 0),
	CONSTRAINT "letter_attachments_durability_range_check" CHECK ("mail"."letter_attachments"."durability" <= "mail"."letter_attachments"."durability_max"),
	CONSTRAINT "letter_attachments_upgrade_id_check" CHECK ("mail"."letter_attachments"."upgrade_id" >= 0),
	CONSTRAINT "letter_attachments_upgrade_level_check" CHECK ("mail"."letter_attachments"."upgrade_level" >= 0 AND "mail"."letter_attachments"."upgrade_level" <= 6),
	CONSTRAINT "letter_attachments_upgrade_bound_check" CHECK ("mail"."letter_attachments"."upgrade_bound" IN (0, 1))
);
--> statement-breakpoint
ALTER TABLE "mail"."letter_attachments" ADD CONSTRAINT "letter_attachments_letter_id_letters_id_fk" FOREIGN KEY ("letter_id") REFERENCES "mail"."letters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mail_letter_attachments_letter_idx" ON "mail"."letter_attachments" USING btree ("letter_id");