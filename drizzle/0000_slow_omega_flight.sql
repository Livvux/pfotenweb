CREATE TYPE "public"."species" AS ENUM('hund', 'katze', 'kleintier', 'vogel', 'sonstiges');--> statement-breakpoint
CREATE TYPE "public"."animal_status" AS ENUM('vermittelbar', 'reserviert', 'vermittelt');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('owner', 'editor');--> statement-breakpoint
CREATE TABLE "animal_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"animal_id" integer NOT NULL,
	"url" text NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "animals" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"slug" varchar(140) NOT NULL,
	"name" varchar(80) NOT NULL,
	"species" "species" NOT NULL,
	"breed" varchar(80),
	"sex" varchar(1) DEFAULT 'u' NOT NULL,
	"birth_year" integer,
	"size" varchar(20),
	"description" text NOT NULL,
	"status" "animal_status" DEFAULT 'vermittelbar' NOT NULL,
	"featured" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "animals_tenant_slug_uq" UNIQUE("tenant_id","slug"),
	CONSTRAINT "animals_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "inquiries" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"name" varchar(80) NOT NULL,
	"email" varchar(160) NOT NULL,
	"subject" varchar(180),
	"message" text NOT NULL,
	"animal_id" integer,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"key" varchar(200) PRIMARY KEY NOT NULL,
	"count" integer DEFAULT 1 NOT NULL,
	"reset_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"slug" varchar(160) NOT NULL,
	"title" varchar(180) NOT NULL,
	"body" text NOT NULL,
	"published" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_tenant_slug_uq" UNIQUE("tenant_id","slug")
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "association_settings" (
	"tenant_id" integer PRIMARY KEY NOT NULL,
	"org_name" varchar(160) NOT NULL,
	"short_name" varchar(60) NOT NULL,
	"legal_form" varchar(40),
	"founded_year" integer,
	"tagline" varchar(200),
	"hero_headline" varchar(200) NOT NULL,
	"hero_subline" text,
	"hero_image_url" text,
	"street" varchar(120),
	"postal_code" varchar(12),
	"city" varchar(80),
	"phone" varchar(40),
	"public_email" varchar(160),
	"opening_hours" text,
	"contact_notify_email" varchar(160),
	"represented_by" text,
	"register_court" varchar(120),
	"register_number" varchar(40),
	"tax_note" text,
	"about_intro" text,
	"about_work" text,
	"about_support" text,
	"facts" jsonb,
	"logo_url" text,
	"color_primary" varchar(9) DEFAULT '#1e4334' NOT NULL,
	"color_accent" varchar(9) DEFAULT '#e4a44c' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "association" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	CONSTRAINT "association_singleton" CHECK ("association"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'editor' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_tenant_username_uq" UNIQUE("tenant_id","username")
);
--> statement-breakpoint
ALTER TABLE "animal_images" ADD CONSTRAINT "animal_images_tenant_id_association_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."association"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animal_images" ADD CONSTRAINT "animal_images_tenant_animal_fk" FOREIGN KEY ("tenant_id","animal_id") REFERENCES "public"."animals"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "animals" ADD CONSTRAINT "animals_tenant_id_association_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."association"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_tenant_id_association_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."association"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_tenant_animal_fk" FOREIGN KEY ("tenant_id","animal_id") REFERENCES "public"."animals"("tenant_id","id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "posts" ADD CONSTRAINT "posts_tenant_id_association_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."association"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_tenant_id_association_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."association"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "association_settings" ADD CONSTRAINT "association_settings_tenant_id_association_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."association"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_association_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."association"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "animal_images_tenant_animal_idx" ON "animal_images" USING btree ("tenant_id","animal_id");--> statement-breakpoint
CREATE INDEX "animals_tenant_species_idx" ON "animals" USING btree ("tenant_id","species");--> statement-breakpoint
CREATE INDEX "animals_tenant_status_idx" ON "animals" USING btree ("tenant_id","status");--> statement-breakpoint
CREATE INDEX "inquiries_tenant_created_idx" ON "inquiries" USING btree ("tenant_id","created_at");--> statement-breakpoint
CREATE INDEX "posts_tenant_published_idx" ON "posts" USING btree ("tenant_id","published");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_tenant_idx" ON "sessions" USING btree ("tenant_id","id");