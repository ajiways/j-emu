CREATE SCHEMA "mail";
--> statement-breakpoint
CREATE TABLE "mail"."letters" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "mail"."letters_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"owner_hero_id" integer NOT NULL,
	"folder" text NOT NULL,
	"peer_hero_id" integer,
	"peer_nick" text NOT NULL,
	"subject" text NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"flags" integer NOT NULL,
	"money_come_minor" bigint NOT NULL,
	"payment_minor" bigint NOT NULL,
	"tax_minor" bigint NOT NULL,
	"money_type" integer NOT NULL,
	"pair_id" integer,
	"system" integer NOT NULL,
	CONSTRAINT "letters_id_check" CHECK ("mail"."letters"."id" > 0),
	CONSTRAINT "letters_folder_check" CHECK ("mail"."letters"."folder" IN ('inbox', 'outbox')),
	CONSTRAINT "letters_flags_check" CHECK ("mail"."letters"."flags" >= 0),
	CONSTRAINT "letters_money_come_minor_check" CHECK ("mail"."letters"."money_come_minor" >= 0),
	CONSTRAINT "letters_payment_minor_check" CHECK ("mail"."letters"."payment_minor" >= 0),
	CONSTRAINT "letters_tax_minor_check" CHECK ("mail"."letters"."tax_minor" >= 0),
	CONSTRAINT "letters_money_type_check" CHECK ("mail"."letters"."money_type" IN (0, 1)),
	CONSTRAINT "letters_system_check" CHECK ("mail"."letters"."system" IN (0, 1))
);
--> statement-breakpoint
ALTER TABLE "mail"."letters" ADD CONSTRAINT "letters_owner_hero_id_heroes_id_fk" FOREIGN KEY ("owner_hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mail"."letters" ADD CONSTRAINT "letters_peer_hero_id_heroes_id_fk" FOREIGN KEY ("peer_hero_id") REFERENCES "character"."heroes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mail_letters_owner_folder_idx" ON "mail"."letters" USING btree ("owner_hero_id","folder");--> statement-breakpoint
CREATE INDEX "mail_letters_expires_at_idx" ON "mail"."letters" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "mail_letters_pair_idx" ON "mail"."letters" USING btree ("pair_id");