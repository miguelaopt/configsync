CREATE TABLE "device_presets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"device_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"preset_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"platform" text,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"applied" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "device_presets" ADD CONSTRAINT "device_presets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_presets" ADD CONSTRAINT "device_presets_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_presets" ADD CONSTRAINT "device_presets_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_presets" ADD CONSTRAINT "device_presets_preset_id_presets_id_fk" FOREIGN KEY ("preset_id") REFERENCES "public"."presets"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "device_presets_device_game_uq" ON "device_presets" USING btree ("device_id","game_id");--> statement-breakpoint
CREATE UNIQUE INDEX "devices_user_name_uq" ON "devices" USING btree ("user_id","name");--> statement-breakpoint
INSERT INTO "devices" ("user_id", "name", "last_seen_at")
SELECT "user_id", "device", max("seen_at") FROM "device_games" GROUP BY 1, 2
ON CONFLICT DO NOTHING;
