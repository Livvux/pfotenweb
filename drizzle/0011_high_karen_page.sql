ALTER TABLE "users" ALTER COLUMN "profile_role" SET DATA TYPE varchar(100);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION media_referenced(target text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM animal_images WHERE url = target)
 OR EXISTS(SELECT 1 FROM users WHERE profile_image = target)
 OR EXISTS(SELECT 1 FROM association_settings WHERE logo_url = target OR hero_image_url = target
  OR jsonb_path_exists(website, '$.** ? (@ == $url)', jsonb_build_object('url', target))
  OR jsonb_path_exists(website_media, '$.** ? (@ == $url)', jsonb_build_object('url', target)))
$$;
--> statement-breakpoint
CREATE FUNCTION queue_removed_profile_image() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.profile_image IS NOT NULL AND (TG_OP = 'DELETE' OR OLD.profile_image IS DISTINCT FROM NEW.profile_image) THEN
  INSERT INTO media_deletions(url) VALUES(OLD.profile_image) ON CONFLICT DO NOTHING;
 END IF;
 RETURN NULL;
END $$;
--> statement-breakpoint
CREATE TRIGGER removed_profile_image AFTER DELETE OR UPDATE ON users FOR EACH ROW EXECUTE FUNCTION queue_removed_profile_image();
