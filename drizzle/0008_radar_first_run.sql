ALTER TABLE "org_supplier_links" ADD COLUMN "regions" text[];--> statement-breakpoint
ALTER TABLE "org_supplier_links" ADD COLUMN "extra_cpv_codes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "org_supplier_links" ADD COLUMN "excluded_cpv_codes" text[] DEFAULT '{}'::text[] NOT NULL;--> statement-breakpoint
ALTER TABLE "org_supplier_links" ADD COLUMN "first_run_pending" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "radar_profiles" ADD COLUMN "first_run_pending" boolean DEFAULT false NOT NULL;