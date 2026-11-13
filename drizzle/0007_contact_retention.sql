ALTER TABLE "supplier_contacts" ADD COLUMN "email_fingerprint" text;--> statement-breakpoint
ALTER TABLE "supplier_contacts" ADD COLUMN "erased_at" timestamp with time zone;