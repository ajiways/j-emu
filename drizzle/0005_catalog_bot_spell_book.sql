CREATE TABLE "catalog"."bot_spell_book_spells" (
	"release_id" uuid NOT NULL,
	"bot_id" integer NOT NULL,
	"ord" integer NOT NULL,
	"artikul_id" integer NOT NULL,
	"slot" text NOT NULL,
	"weight" integer NOT NULL,
	"max_casts" integer,
	"gate" text,
	"hp_pct" integer,
	"spell" jsonb NOT NULL,
	CONSTRAINT "bot_spell_book_spells_release_id_bot_id_artikul_id_pk" PRIMARY KEY("release_id","bot_id","artikul_id"),
	CONSTRAINT "bot_spell_book_spells_slot_check" CHECK ("catalog"."bot_spell_book_spells"."slot" IN ('fight_start', 'prefer', 'turn_roulette', 'never')),
	CONSTRAINT "bot_spell_book_spells_ord_check" CHECK ("catalog"."bot_spell_book_spells"."ord" >= 0),
	CONSTRAINT "bot_spell_book_spells_weight_check" CHECK ("catalog"."bot_spell_book_spells"."weight" >= 0),
	CONSTRAINT "bot_spell_book_spells_max_casts_check" CHECK ("catalog"."bot_spell_book_spells"."max_casts" IS NULL OR "catalog"."bot_spell_book_spells"."max_casts" >= 1),
	CONSTRAINT "bot_spell_book_spells_gate_check" CHECK ("catalog"."bot_spell_book_spells"."gate" IS NULL OR "catalog"."bot_spell_book_spells"."gate" = 'self_hp_le'),
	CONSTRAINT "bot_spell_book_spells_hp_pct_check" CHECK ("catalog"."bot_spell_book_spells"."hp_pct" IS NULL OR ("catalog"."bot_spell_book_spells"."hp_pct" >= 1 AND "catalog"."bot_spell_book_spells"."hp_pct" <= 100))
);
--> statement-breakpoint
CREATE TABLE "catalog"."bot_spell_books" (
	"release_id" uuid NOT NULL,
	"bot_id" integer NOT NULL,
	"nothing_weight" integer NOT NULL,
	CONSTRAINT "bot_spell_books_release_id_bot_id_pk" PRIMARY KEY("release_id","bot_id"),
	CONSTRAINT "bot_spell_books_nothing_weight_check" CHECK ("catalog"."bot_spell_books"."nothing_weight" >= 0)
);
--> statement-breakpoint
ALTER TABLE "catalog"."bot_spell_book_spells" ADD CONSTRAINT "bot_spell_book_spells_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bot_spell_book_spells" ADD CONSTRAINT "bot_spell_book_spells_book_fk" FOREIGN KEY ("release_id","bot_id") REFERENCES "catalog"."bot_spell_books"("release_id","bot_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bot_spell_books" ADD CONSTRAINT "bot_spell_books_release_id_releases_id_fk" FOREIGN KEY ("release_id") REFERENCES "content"."releases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "catalog"."bot_spell_books" ADD CONSTRAINT "bot_spell_books_bot_fk" FOREIGN KEY ("release_id","bot_id") REFERENCES "catalog"."bots"("release_id","id") ON DELETE restrict ON UPDATE no action;