CREATE TABLE "security_challenges" (
	"id" varchar(36) PRIMARY KEY NOT NULL,
	"user_id" integer,
	"kind" varchar(16) NOT NULL,
	"email" varchar(160) NOT NULL,
	"token_hash" varchar(64) NOT NULL,
	"payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "auth_sessions" ADD COLUMN "reauthenticated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "tour_completed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "inquiries_seen_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "security_challenges" ADD CONSTRAINT "security_challenges_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "security_challenges_user_idx" ON "security_challenges" USING btree ("user_id");