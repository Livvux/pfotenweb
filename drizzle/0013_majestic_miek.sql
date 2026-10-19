CREATE TABLE "content_import_candidates" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"run_id" integer NOT NULL,
	"source_key" text NOT NULL,
	"raw" jsonb NOT NULL,
	"draft" jsonb NOT NULL,
	"warnings" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"selected" boolean DEFAULT false NOT NULL,
	"text_confirmed" boolean DEFAULT false NOT NULL,
	"previous_text" text,
	"duplicate" boolean DEFAULT false NOT NULL,
	"state" varchar(16) DEFAULT 'pending' NOT NULL,
	"error" text,
	"target_id" integer,
	CONSTRAINT "content_import_candidates_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "content_import_images" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"candidate_id" integer NOT NULL,
	"source_url" text NOT NULL,
	"stage_key" text,
	"target_key" text,
	"state" varchar(16) DEFAULT 'pending' NOT NULL,
	"omitted" boolean DEFAULT false NOT NULL,
	"bytes" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "content_import_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"state" varchar(20) DEFAULT 'preparing' NOT NULL,
	"format" varchar(16) NOT NULL,
	"source" text,
	"source_name" varchar(200) NOT NULL,
	"namespace" varchar(200) NOT NULL,
	"mapping" jsonb,
	"error" text,
	"approved_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "content_import_runs_tenant_id_uq" UNIQUE("tenant_id","id")
);
--> statement-breakpoint
CREATE TABLE "content_import_sources" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"source_hash" varchar(64) NOT NULL,
	"kind" varchar(16) NOT NULL,
	"target_id" integer,
	CONSTRAINT "content_import_sources_tenant_hash_uq" UNIQUE("tenant_id","source_hash")
);
--> statement-breakpoint
ALTER TABLE "content_import_candidates" ADD CONSTRAINT "content_import_candidates_tenant_id_run_id_content_import_runs_tenant_id_id_fk" FOREIGN KEY ("tenant_id","run_id") REFERENCES "public"."content_import_runs"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_import_images" ADD CONSTRAINT "content_import_images_tenant_id_candidate_id_content_import_candidates_tenant_id_id_fk" FOREIGN KEY ("tenant_id","candidate_id") REFERENCES "public"."content_import_candidates"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_import_runs" ADD CONSTRAINT "content_import_runs_tenant_id_association_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."association"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "content_import_sources" ADD CONSTRAINT "content_import_sources_tenant_id_association_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."association"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "content_import_candidates_run_idx" ON "content_import_candidates" USING btree ("tenant_id","run_id");--> statement-breakpoint
CREATE INDEX "content_import_images_candidate_idx" ON "content_import_images" USING btree ("tenant_id","candidate_id");--> statement-breakpoint
CREATE INDEX "content_import_runs_state_idx" ON "content_import_runs" USING btree ("state","updated_at");
--> statement-breakpoint
CREATE FUNCTION queue_removed_import_image() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.stage_key IS NOT NULL THEN INSERT INTO media_deletions(url) VALUES('/uploads/' || OLD.stage_key) ON CONFLICT DO NOTHING; END IF;
 IF OLD.target_key IS NOT NULL THEN INSERT INTO media_deletions(url) VALUES('/uploads/' || OLD.target_key) ON CONFLICT DO NOTHING; END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER removed_import_image AFTER DELETE ON content_import_images FOR EACH ROW EXECUTE FUNCTION queue_removed_import_image();

--> statement-breakpoint
CREATE OR REPLACE FUNCTION media_referenced(target text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM animal_images WHERE url = target)
 OR EXISTS(SELECT 1 FROM users WHERE profile_image = target)
 OR EXISTS(SELECT 1 FROM content_import_images WHERE '/uploads/' || stage_key = target)
 OR EXISTS(SELECT 1 FROM association_settings WHERE logo_url = target OR hero_image_url = target
  OR jsonb_path_exists(website, '$.** ? (@ == $url)', jsonb_build_object('url', target))
  OR jsonb_path_exists(website_media, '$.** ? (@ == $url)', jsonb_build_object('url', target)))
$$;
