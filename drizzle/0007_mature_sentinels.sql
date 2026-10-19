CREATE TABLE "inquiry_replies" (
	"id" serial PRIMARY KEY NOT NULL,
	"tenant_id" integer NOT NULL,
	"inquiry_id" integer NOT NULL,
	"request_id" varchar(36) NOT NULL,
	"author_name" varchar(50) NOT NULL,
	"body" text NOT NULL,
	"delivery_status" varchar(16) DEFAULT 'imported' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inquiry_replies_request_uq" UNIQUE("tenant_id","request_id")
);
--> statement-breakpoint
ALTER TABLE "inquiries" DROP CONSTRAINT "inquiries_tenant_animal_fk";
--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_tenant_id_uq" UNIQUE("tenant_id","id");--> statement-breakpoint
ALTER TABLE "inquiry_replies" ADD CONSTRAINT "inquiry_replies_tenant_id_inquiry_id_inquiries_tenant_id_id_fk" FOREIGN KEY ("tenant_id","inquiry_id") REFERENCES "public"."inquiries"("tenant_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inquiry_replies_inquiry_idx" ON "inquiry_replies" USING btree ("tenant_id","inquiry_id");--> statement-breakpoint
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_tenant_animal_fk" FOREIGN KEY ("tenant_id","animal_id") REFERENCES "public"."animals"("tenant_id","id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE FUNCTION detach_animal_inquiries() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  UPDATE inquiries SET animal_id = NULL WHERE tenant_id = OLD.tenant_id AND animal_id = OLD.id;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER detach_animal_inquiries BEFORE DELETE ON animals FOR EACH ROW EXECUTE FUNCTION detach_animal_inquiries();
