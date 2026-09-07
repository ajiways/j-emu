CREATE SCHEMA "identity";
--> statement-breakpoint
CREATE TABLE "identity"."accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
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
	"account_id" uuid NOT NULL,
	"session_key" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "sessions_account_id_unique" UNIQUE("account_id")
);
