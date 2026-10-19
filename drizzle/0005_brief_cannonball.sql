CREATE TABLE "donation_settings" (
	"tenant_id" integer PRIMARY KEY NOT NULL,
	"heading" varchar(120) DEFAULT 'Gemeinsam Tieren helfen' NOT NULL,
	"introduction" text DEFAULT '' NOT NULL,
	"receipt_note" text DEFAULT '' NOT NULL,
	"account_holder" varchar(160) DEFAULT '' NOT NULL,
	"iban" varchar(34) DEFAULT '' NOT NULL,
	"bic" varchar(11) DEFAULT '' NOT NULL,
	"bank_name" varchar(160) DEFAULT '' NOT NULL,
	"purpose" varchar(140) DEFAULT '' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "donation_settings" ADD CONSTRAINT "donation_settings_tenant_id_association_id_fk" FOREIGN KEY ("tenant_id") REFERENCES "public"."association"("id") ON DELETE cascade ON UPDATE no action;