ALTER TABLE "users" ADD COLUMN "active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "permissions" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "display_name" varchar(80);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_role" varchar(80);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "profile_image" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_email" varchar(160);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "recovery_email_verified_at" timestamp with time zone;--> statement-breakpoint
-- Existing editorial accounts retain their existing three areas. New accounts start without grants.
UPDATE users SET permissions = ARRAY['animals','posts','inquiries'] WHERE role = 'editor';
