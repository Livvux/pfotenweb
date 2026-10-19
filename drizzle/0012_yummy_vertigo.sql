ALTER TABLE "animals" ADD COLUMN "public_id" uuid DEFAULT gen_random_uuid() NOT NULL;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_public_id_unique" UNIQUE("public_id");