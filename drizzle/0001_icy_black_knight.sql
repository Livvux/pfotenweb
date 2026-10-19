CREATE TABLE "media_deletions" (
	"url" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE FUNCTION media_referenced(target text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM animal_images WHERE url = target)
 OR EXISTS(SELECT 1 FROM association_settings WHERE logo_url = target OR hero_image_url = target)
$$;
--> statement-breakpoint
CREATE FUNCTION queue_removed_image() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP = 'DELETE' OR OLD.url IS DISTINCT FROM NEW.url THEN
  INSERT INTO media_deletions(url) VALUES(OLD.url) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER removed_animal_image AFTER DELETE OR UPDATE ON animal_images FOR EACH ROW EXECUTE FUNCTION queue_removed_image();
--> statement-breakpoint
CREATE FUNCTION queue_removed_setting_images() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.logo_url IS NOT NULL AND (TG_OP = 'DELETE' OR OLD.logo_url IS DISTINCT FROM NEW.logo_url) THEN
  INSERT INTO media_deletions(url) VALUES(OLD.logo_url) ON CONFLICT DO NOTHING;
 END IF;
 IF OLD.hero_image_url IS NOT NULL AND (TG_OP = 'DELETE' OR OLD.hero_image_url IS DISTINCT FROM NEW.hero_image_url) THEN
  INSERT INTO media_deletions(url) VALUES(OLD.hero_image_url) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER removed_setting_images AFTER DELETE OR UPDATE ON association_settings FOR EACH ROW EXECUTE FUNCTION queue_removed_setting_images();
