CREATE TABLE "outreach_audit" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" text,
	"action" text NOT NULL,
	"campaign_id" uuid,
	"count" integer DEFAULT 0 NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outreach_campaigns" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"segment" jsonb NOT NULL,
	"template_key" text NOT NULL,
	"template_variant" text NOT NULL,
	"build_summary" jsonb NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exported_at" timestamp with time zone,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "outreach_prospects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"campaign_id" uuid NOT NULL,
	"supplier_id" text NOT NULL,
	"contact_id" text,
	"email" text,
	"email_hash" text,
	"email_kind" text NOT NULL,
	"ref_code" text NOT NULL,
	"status" text DEFAULT 'listed' NOT NULL,
	"skipped_reason" text,
	"eligibility" jsonb NOT NULL,
	"merge_fields" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"exported_at" timestamp with time zone,
	"sent_at" timestamp with time zone,
	"opted_out_at" timestamp with time zone,
	"erased_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "suppressions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text,
	"domain" text,
	"reason" text NOT NULL,
	"source" text NOT NULL,
	"note" text,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "suppressions_target_check" CHECK (("suppressions"."email" is null) <> ("suppressions"."domain" is null)),
	CONSTRAINT "suppressions_lowercase_check" CHECK ("suppressions"."email" = lower("suppressions"."email") and "suppressions"."domain" = lower("suppressions"."domain"))
);
--> statement-breakpoint
ALTER TABLE "outreach_prospects" ADD CONSTRAINT "outreach_prospects_campaign_id_outreach_campaigns_id_fk" FOREIGN KEY ("campaign_id") REFERENCES "public"."outreach_campaigns"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_prospects" ADD CONSTRAINT "outreach_prospects_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "outreach_prospects" ADD CONSTRAINT "outreach_prospects_contact_id_supplier_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."supplier_contacts"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "outreach_audit_created_at_idx" ON "outreach_audit" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "outreach_audit_campaign_idx" ON "outreach_audit" USING btree ("campaign_id");--> statement-breakpoint
CREATE INDEX "outreach_campaigns_created_at_idx" ON "outreach_campaigns" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_prospects_ref_code_key" ON "outreach_prospects" USING btree ("ref_code");--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_prospects_campaign_supplier_key" ON "outreach_prospects" USING btree ("campaign_id","supplier_id");--> statement-breakpoint
CREATE UNIQUE INDEX "outreach_prospects_campaign_email_key" ON "outreach_prospects" USING btree ("campaign_id","email");--> statement-breakpoint
CREATE INDEX "outreach_prospects_email_hash_idx" ON "outreach_prospects" USING btree ("email_hash");--> statement-breakpoint
CREATE INDEX "outreach_prospects_email_idx" ON "outreach_prospects" USING btree ("email");--> statement-breakpoint
CREATE INDEX "outreach_prospects_supplier_idx" ON "outreach_prospects" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "outreach_prospects_campaign_status_idx" ON "outreach_prospects" USING btree ("campaign_id","status");--> statement-breakpoint
CREATE UNIQUE INDEX "suppressions_email_key" ON "suppressions" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "suppressions_domain_key" ON "suppressions" USING btree ("domain");