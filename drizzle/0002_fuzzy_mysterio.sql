ALTER TABLE "animals" ADD COLUMN "profile" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD COLUMN "revision" integer DEFAULT 0 NOT NULL;