ALTER TABLE "association_settings" ADD COLUMN "visitor_address" varchar(3) DEFAULT 'sie' NOT NULL;--> statement-breakpoint
ALTER TABLE "association_settings" ADD COLUMN "admin_address" varchar(3) DEFAULT 'sie' NOT NULL;--> statement-breakpoint
ALTER TABLE "association_settings" ADD COLUMN "animations_enabled" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "association_settings" ADD COLUMN "website" jsonb;--> statement-breakpoint
ALTER TABLE "association_settings" ADD COLUMN "website_revision" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "association_settings" ADD COLUMN "website_media" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
CREATE OR REPLACE FUNCTION media_referenced(target text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM animal_images WHERE url = target)
 OR EXISTS(SELECT 1 FROM association_settings WHERE logo_url = target OR hero_image_url = target
  OR jsonb_path_exists(website, '$.** ? (@ == $url)', jsonb_build_object('url', target))
  OR jsonb_path_exists(website_media, '$.** ? (@ == $url)', jsonb_build_object('url', target)))
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION queue_removed_setting_images() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE candidate text;
BEGIN
 IF OLD.logo_url IS NOT NULL AND (TG_OP = 'DELETE' OR OLD.logo_url IS DISTINCT FROM NEW.logo_url) THEN
  INSERT INTO media_deletions(url) VALUES(OLD.logo_url) ON CONFLICT DO NOTHING;
 END IF;
 IF OLD.hero_image_url IS NOT NULL AND (TG_OP = 'DELETE' OR OLD.hero_image_url IS DISTINCT FROM NEW.hero_image_url) THEN
  INSERT INTO media_deletions(url) VALUES(OLD.hero_image_url) ON CONFLICT DO NOTHING;
 END IF;
 FOR candidate IN SELECT value #>> '{}' FROM jsonb_path_query(jsonb_build_array(OLD.website, OLD.website_media), '$.** ? (@.type() == "string")') value LOOP
  IF candidate LIKE '/uploads/t1/%' THEN
   INSERT INTO media_deletions(url) VALUES(candidate) ON CONFLICT DO NOTHING;
  END IF;
 END LOOP;
 RETURN NULL;
END $$;
