CREATE TYPE "public"."device_game_source" AS ENUM('steam', 'epic');--> statement-breakpoint
CREATE TABLE "companion_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"token_hash" text NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_games" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"device" text NOT NULL,
	"source" "device_game_source" NOT NULL,
	"app_id" text NOT NULL,
	"name" text NOT NULL,
	"install_dir" text,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "catalog_id" text;--> statement-breakpoint
ALTER TABLE "companion_tokens" ADD CONSTRAINT "companion_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_games" ADD CONSTRAINT "device_games_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "companion_tokens_hash_uq" ON "companion_tokens" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "companion_tokens_user_idx" ON "companion_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_games_uq" ON "device_games" USING btree ("user_id","device","source","app_id");