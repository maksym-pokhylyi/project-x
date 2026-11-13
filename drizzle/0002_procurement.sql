CREATE TABLE "awards" (
	"id" text PRIMARY KEY NOT NULL,
	"notice_id" text NOT NULL,
	"release_id" text NOT NULL,
	"ocid" text NOT NULL,
	"award_ref" text NOT NULL,
	"contract_ref" text,
	"lot_key" text DEFAULT '' NOT NULL,
	"lots" text[] DEFAULT '{}'::text[] NOT NULL,
	"supplier_id" text NOT NULL,
	"supplier_basis" text DEFAULT 'coh' NOT NULL,
	"buyer_id" text,
	"title" text NOT NULL,
	"cpv_main" text,
	"cpv_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"cpv_divisions" text[] DEFAULT '{}'::text[] NOT NULL,
	"cpv_groups" text[] DEFAULT '{}'::text[] NOT NULL,
	"cpv_classes" text[] DEFAULT '{}'::text[] NOT NULL,
	"category" text,
	"value_amount" numeric(18, 2),
	"value_gross" numeric(18, 2),
	"currency" text,
	"value_shared" boolean DEFAULT false NOT NULL,
	"suppliers_count" integer DEFAULT 1 NOT NULL,
	"status" text NOT NULL,
	"effective_status" text NOT NULL,
	"ended_early_at" timestamp with time zone,
	"awarded_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"contract_start" timestamp with time zone,
	"contract_end" timestamp with time zone,
	"max_extent_end" timestamp with time zone,
	"has_renewal" boolean,
	"procedure" text,
	"competition" text DEFAULT 'unknown' NOT NULL,
	"above_threshold" boolean,
	"is_framework" boolean DEFAULT false NOT NULL,
	"notice_type" text,
	"published_at" timestamp with time zone NOT NULL,
	"region_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"regions" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_current" boolean DEFAULT false NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (to_tsvector('english', coalesce("awards"."title", ''))) STORED
);
--> statement-breakpoint
CREATE TABLE "buyers" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"ppon" text,
	"name" text NOT NULL,
	"name_norm" text NOT NULL,
	"slug" text NOT NULL,
	"buyer_type" text,
	"devolved" text,
	"region_code" text,
	"region" text,
	"locality" text,
	"postcode_area" text,
	"website" text,
	"notices_count" integer DEFAULT 0 NOT NULL,
	"awards_count" integer DEFAULT 0 NOT NULL,
	"awards_value" numeric(18, 2) DEFAULT 0 NOT NULL,
	"last_notice_at" timestamp with time zone,
	"merged_into" text,
	"source_date" timestamp with time zone NOT NULL,
	"source_release_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cpv_codes" (
	"code" text PRIMARY KEY NOT NULL,
	"label" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"kind" text NOT NULL,
	"page_url" text,
	"organisation_name" text,
	"requester_email" text NOT NULL,
	"message" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "ingest_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" text NOT NULL,
	"mode" text NOT NULL,
	"status" text NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"pages" integer DEFAULT 0 NOT NULL,
	"releases" integer DEFAULT 0 NOT NULL,
	"notices" integer DEFAULT 0 NOT NULL,
	"awards" integer DEFAULT 0 NOT NULL,
	"suppliers_touched" integer DEFAULT 0 NOT NULL,
	"rate_limited" integer DEFAULT 0 NOT NULL,
	"window_from" text,
	"window_to" text,
	"error" text,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_state" (
	"source" text PRIMARY KEY NOT NULL,
	"cursor" text,
	"next_url" text,
	"window_to" text,
	"next_request_at" timestamp with time zone,
	"locked_until" timestamp with time zone,
	"last_run_at" timestamp with time zone,
	"last_success_at" timestamp with time zone,
	"last_error" text,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_reasons" (
	"profile_key" text NOT NULL,
	"ocid" text NOT NULL,
	"reason" text NOT NULL,
	"model" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_reasons_profile_key_ocid_pk" PRIMARY KEY("profile_key","ocid")
);
--> statement-breakpoint
CREATE TABLE "notices" (
	"id" text PRIMARY KEY NOT NULL,
	"release_id" text NOT NULL,
	"ocid" text NOT NULL,
	"stage" text NOT NULL,
	"notice_type" text,
	"regime" text NOT NULL,
	"tags" text[] DEFAULT '{}'::text[] NOT NULL,
	"is_update" boolean DEFAULT false NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" text,
	"buyer_id" text,
	"cpv_main" text,
	"cpv_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"cpv_divisions" text[] DEFAULT '{}'::text[] NOT NULL,
	"cpv_groups" text[] DEFAULT '{}'::text[] NOT NULL,
	"cpv_classes" text[] DEFAULT '{}'::text[] NOT NULL,
	"cpv_text" text,
	"category" text,
	"value_amount" numeric(18, 2),
	"value_gross" numeric(18, 2),
	"currency" text,
	"value_placeholder" boolean DEFAULT false NOT NULL,
	"procedure" text,
	"procurement_method" text,
	"competition" text DEFAULT 'unknown' NOT NULL,
	"above_threshold" boolean,
	"is_framework" boolean DEFAULT false NOT NULL,
	"special_regimes" text[] DEFAULT '{}'::text[] NOT NULL,
	"published_at" timestamp with time zone NOT NULL,
	"deadline_at" timestamp with time zone,
	"enquiry_deadline_at" timestamp with time zone,
	"contract_start" timestamp with time zone,
	"contract_end" timestamp with time zone,
	"future_notice_at" timestamp with time zone,
	"engagement_deadline_at" timestamp with time zone,
	"region_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"regions" text[] DEFAULT '{}'::text[] NOT NULL,
	"region_source" text,
	"notice_url" text NOT NULL,
	"award_criteria" jsonb,
	"lots" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"lots_count" integer DEFAULT 0 NOT NULL,
	"sme_suitable" boolean,
	"vcse_suitable" boolean,
	"bids_count" integer,
	"suppliers_count" integer DEFAULT 0 NOT NULL,
	"effects" jsonb,
	"is_latest" boolean DEFAULT false NOT NULL,
	"search" "tsvector" GENERATED ALWAYS AS (setweight(to_tsvector('english', coalesce("notices"."title", '')), 'A') || setweight(to_tsvector('english', coalesce("notices"."cpv_text", '')), 'B') || setweight(to_tsvector('english', left(coalesce("notices"."description", ''), 6000)), 'C')) STORED,
	"ingested_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_supplier_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"supplier_id" text NOT NULL,
	"created_by" text,
	"method" text DEFAULT 'self_declared' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "page_visits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"page_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"ref_code" text,
	"is_bot" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procurement_aliases" (
	"kind" text NOT NULL,
	"alias_key" text NOT NULL,
	"entity_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "procurement_aliases_kind_alias_key_pk" PRIMARY KEY("kind","alias_key")
);
--> statement-breakpoint
CREATE TABLE "radar_items" (
	"organization_id" text NOT NULL,
	"ocid" text NOT NULL,
	"state" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "radar_items_organization_id_ocid_pk" PRIMARY KEY("organization_id","ocid")
);
--> statement-breakpoint
CREATE TABLE "radar_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"name" text NOT NULL,
	"cpv_codes" text[] DEFAULT '{}'::text[] NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"regions" text[] DEFAULT '{}'::text[] NOT NULL,
	"value_min" numeric(18, 2),
	"value_max" numeric(18, 2),
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_contacts" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"email" text NOT NULL,
	"email_domain" text NOT NULL,
	"kind" text NOT NULL,
	"name_present" boolean DEFAULT false NOT NULL,
	"domain_matches_website" boolean,
	"source_release_id" text NOT NULL,
	"first_seen_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"first_ingested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"suppressed_at" timestamp with time zone,
	"suppressed_reason" text
);
--> statement-breakpoint
CREATE TABLE "supplier_profiles" (
	"supplier_id" text PRIMARY KEY NOT NULL,
	"cpv_weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"cpv_divisions" text[] DEFAULT '{}'::text[] NOT NULL,
	"cpv_groups" text[] DEFAULT '{}'::text[] NOT NULL,
	"top_cpv" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"keywords" text[] DEFAULT '{}'::text[] NOT NULL,
	"regions" text[] DEFAULT '{}'::text[] NOT NULL,
	"home_region" text,
	"value_low" numeric(18, 2),
	"value_median" numeric(18, 2),
	"value_high" numeric(18, 2),
	"awards_count" integer DEFAULT 0 NOT NULL,
	"total_value" numeric(18, 2) DEFAULT 0 NOT NULL,
	"summary" text,
	"stats" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"identity_basis" text NOT NULL,
	"coh" text,
	"ppon" text,
	"name" text NOT NULL,
	"name_norm" text NOT NULL,
	"slug" text NOT NULL,
	"scale" text,
	"vcse" boolean,
	"legal_form" text DEFAULT 'unknown' NOT NULL,
	"is_incorporated" boolean DEFAULT false NOT NULL,
	"legal_evidence" text DEFAULT 'none' NOT NULL,
	"country" text,
	"region_code" text,
	"region" text,
	"locality" text,
	"postcode_area" text,
	"website" text,
	"awards_count" integer DEFAULT 0 NOT NULL,
	"total_value" numeric(18, 2) DEFAULT 0 NOT NULL,
	"buyers_count" integer DEFAULT 0 NOT NULL,
	"first_award_at" timestamp with time zone,
	"last_award_at" timestamp with time zone,
	"merged_into" text,
	"removed_at" timestamp with time zone,
	"source_date" timestamp with time zone NOT NULL,
	"source_release_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_notice_id_notices_id_fk" FOREIGN KEY ("notice_id") REFERENCES "public"."notices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "awards" ADD CONSTRAINT "awards_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notices" ADD CONSTRAINT "notices_buyer_id_buyers_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."buyers"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_supplier_links" ADD CONSTRAINT "org_supplier_links_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_supplier_links" ADD CONSTRAINT "org_supplier_links_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_items" ADD CONSTRAINT "radar_items_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "radar_profiles" ADD CONSTRAINT "radar_profiles_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_contacts" ADD CONSTRAINT "supplier_contacts_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_profiles" ADD CONSTRAINT "supplier_profiles_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "awards_supplier_idx" ON "awards" USING btree ("supplier_id","is_current");--> statement-breakpoint
CREATE INDEX "awards_buyer_idx" ON "awards" USING btree ("buyer_id","is_current");--> statement-breakpoint
CREATE INDEX "awards_ocid_idx" ON "awards" USING btree ("ocid");--> statement-breakpoint
CREATE INDEX "awards_notice_idx" ON "awards" USING btree ("notice_id");--> statement-breakpoint
CREATE INDEX "awards_contract_end_idx" ON "awards" USING btree ("contract_end") WHERE "awards"."is_current";--> statement-breakpoint
CREATE INDEX "awards_cpv_groups_idx" ON "awards" USING gin ("cpv_groups");--> statement-breakpoint
CREATE INDEX "awards_cpv_divisions_idx" ON "awards" USING gin ("cpv_divisions");--> statement-breakpoint
CREATE INDEX "awards_search_idx" ON "awards" USING gin ("search");--> statement-breakpoint
CREATE UNIQUE INDEX "buyers_slug_key" ON "buyers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "buyers_name_norm_idx" ON "buyers" USING btree ("name_norm");--> statement-breakpoint
CREATE INDEX "buyers_awards_count_idx" ON "buyers" USING btree ("awards_count");--> statement-breakpoint
CREATE INDEX "data_requests_status_idx" ON "data_requests" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "ingest_runs_started_at_idx" ON "ingest_runs" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "notices_ocid_stage_idx" ON "notices" USING btree ("ocid","stage","published_at");--> statement-breakpoint
CREATE INDEX "notices_release_id_idx" ON "notices" USING btree ("release_id");--> statement-breakpoint
CREATE INDEX "notices_buyer_id_idx" ON "notices" USING btree ("buyer_id","published_at");--> statement-breakpoint
CREATE INDEX "notices_live_idx" ON "notices" USING btree ("deadline_at") WHERE "notices"."is_latest" and "notices"."stage" = 'tender';--> statement-breakpoint
CREATE INDEX "notices_planning_idx" ON "notices" USING btree ("published_at") WHERE "notices"."is_latest" and "notices"."stage" = 'planning';--> statement-breakpoint
CREATE INDEX "notices_cpv_groups_idx" ON "notices" USING gin ("cpv_groups");--> statement-breakpoint
CREATE INDEX "notices_cpv_divisions_idx" ON "notices" USING gin ("cpv_divisions");--> statement-breakpoint
CREATE INDEX "notices_search_idx" ON "notices" USING gin ("search");--> statement-breakpoint
CREATE UNIQUE INDEX "org_supplier_links_org_supplier_key" ON "org_supplier_links" USING btree ("organization_id","supplier_id");--> statement-breakpoint
CREATE INDEX "org_supplier_links_supplier_idx" ON "org_supplier_links" USING btree ("supplier_id");--> statement-breakpoint
CREATE INDEX "page_visits_entity_idx" ON "page_visits" USING btree ("page_type","entity_id","created_at");--> statement-breakpoint
CREATE INDEX "page_visits_ref_code_idx" ON "page_visits" USING btree ("ref_code");--> statement-breakpoint
CREATE INDEX "procurement_aliases_entity_idx" ON "procurement_aliases" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "radar_items_org_state_idx" ON "radar_items" USING btree ("organization_id","state");--> statement-breakpoint
CREATE INDEX "radar_profiles_organization_idx" ON "radar_profiles" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "supplier_contacts_supplier_email_key" ON "supplier_contacts" USING btree ("supplier_id","email");--> statement-breakpoint
CREATE INDEX "supplier_contacts_domain_idx" ON "supplier_contacts" USING btree ("email_domain");--> statement-breakpoint
CREATE UNIQUE INDEX "suppliers_slug_key" ON "suppliers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "suppliers_coh_idx" ON "suppliers" USING btree ("coh");--> statement-breakpoint
CREATE INDEX "suppliers_name_norm_idx" ON "suppliers" USING btree ("name_norm");--> statement-breakpoint
CREATE INDEX "suppliers_awards_count_idx" ON "suppliers" USING btree ("awards_count");--> statement-breakpoint
CREATE INDEX "suppliers_last_award_at_idx" ON "suppliers" USING btree ("last_award_at");--> statement-breakpoint
-- Procurement module: objects that Drizzle's schema cannot express.
-- Idempotent. Append to the migration that creates the procurement tables
-- (src/db/schema/procurement.ts), AFTER the generated CREATE TABLE statements.
-- Neon and local PostgreSQL 16 both ship pg_trgm as a trusted extension.

CREATE EXTENSION IF NOT EXISTS pg_trgm;
--> statement-breakpoint
-- Name search on /find ("searchSuppliers"): trigram similarity over the normalised name.
CREATE INDEX IF NOT EXISTS "suppliers_name_norm_trgm_idx" ON "suppliers" USING gin ("name_norm" gin_trgm_ops);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "buyers_name_norm_trgm_idx" ON "buyers" USING gin ("name_norm" gin_trgm_ops);
--> statement-breakpoint
-- Trade picker: search official CPV labels.
CREATE INDEX IF NOT EXISTS "cpv_codes_label_trgm_idx" ON "cpv_codes" USING gin (lower("label") gin_trgm_ops);
