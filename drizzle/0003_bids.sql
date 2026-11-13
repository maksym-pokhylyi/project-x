CREATE TABLE "bid_credits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text DEFAULT 'bid_pass' NOT NULL,
	"source" text DEFAULT 'admin' NOT NULL,
	"external_ref" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"consumed_at" timestamp with time zone,
	"consumed_bid_id" uuid
);
--> statement-breakpoint
CREATE TABLE "bid_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"bid_id" uuid NOT NULL,
	"parent_file_id" uuid,
	"storage_key" text NOT NULL,
	"name" text NOT NULL,
	"mime" text NOT NULL,
	"kind" text NOT NULL,
	"size" bigint NOT NULL,
	"pages" integer,
	"extraction_status" text DEFAULT 'pending' NOT NULL,
	"text_storage_key" text,
	"low_text" boolean DEFAULT false NOT NULL,
	"transcribed_pages" integer DEFAULT 0 NOT NULL,
	"char_count" integer DEFAULT 0 NOT NULL,
	"token_count" integer DEFAULT 0 NOT NULL,
	"included_in_analysis" boolean DEFAULT true NOT NULL,
	"error" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bid_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"bid_id" uuid NOT NULL,
	"ref" text DEFAULT '' NOT NULL,
	"title" text,
	"text" text NOT NULL,
	"section" text,
	"weighting" numeric(6, 2),
	"max_score" numeric(8, 2),
	"word_limit" integer,
	"page_limit" numeric(5, 1),
	"limit_text" text,
	"guidance" text,
	"scored" text DEFAULT 'unclear' NOT NULL,
	"scoring_descriptors" jsonb,
	"citation" jsonb,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"status" text DEFAULT 'not_started' NOT NULL,
	"draft_text" text,
	"draft_meta" jsonb,
	"evaluation" jsonb,
	"provenance" jsonb,
	"versions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"user_edited" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'ai' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bid_requirements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"bid_id" uuid NOT NULL,
	"ref" text DEFAULT '' NOT NULL,
	"category" text DEFAULT 'other' NOT NULL,
	"text" text NOT NULL,
	"threshold" text,
	"kind" text DEFAULT 'mandatory' NOT NULL,
	"is_pass_fail" boolean DEFAULT false NOT NULL,
	"evidence_to_provide" text,
	"citation" jsonb,
	"company_status" text DEFAULT 'unknown' NOT NULL,
	"company_note" text,
	"checked_at" timestamp with time zone,
	"checked_by" text,
	"provenance" jsonb,
	"company_status_source" text DEFAULT 'ai' NOT NULL,
	"note" text,
	"user_edited" boolean DEFAULT false NOT NULL,
	"source" text DEFAULT 'ai' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bids" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"notice_id" text,
	"title" text NOT NULL,
	"buyer_name" text,
	"reference" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"access_level" text DEFAULT 'brief' NOT NULL,
	"access_source" text,
	"allowance_period_start" timestamp with time zone,
	"processing_stage" text,
	"processing_progress" integer DEFAULT 0 NOT NULL,
	"processing_state" jsonb,
	"submission_deadline" timestamp with time zone,
	"key_dates" jsonb,
	"brief" jsonb,
	"verdict" jsonb,
	"evaluation_model" jsonb,
	"pack_stats" jsonb,
	"review" jsonb,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processing_started_at" timestamp with time zone,
	"processing_lock_at" timestamp with time zone,
	"ready_at" timestamp with time zone,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "company_facts" (
	"organization_id" text PRIMARY KEY NOT NULL,
	"facts" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"draft" jsonb,
	"draft_source" jsonb,
	"confirmed_at" timestamp with time zone,
	"confirmed_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "library_docs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text DEFAULT 'other' NOT NULL,
	"title" text NOT NULL,
	"storage_key" text NOT NULL,
	"file_name" text NOT NULL,
	"mime" text NOT NULL,
	"size" bigint NOT NULL,
	"text_storage_key" text,
	"summary" text,
	"key_facts" jsonb,
	"expires_at" date,
	"status" text DEFAULT 'processing' NOT NULL,
	"error" text,
	"token_count" integer DEFAULT 0 NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bid_credits" ADD CONSTRAINT "bid_credits_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_credits" ADD CONSTRAINT "bid_credits_consumed_bid_id_bids_id_fk" FOREIGN KEY ("consumed_bid_id") REFERENCES "public"."bids"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_files" ADD CONSTRAINT "bid_files_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_files" ADD CONSTRAINT "bid_files_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_questions" ADD CONSTRAINT "bid_questions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_questions" ADD CONSTRAINT "bid_questions_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_requirements" ADD CONSTRAINT "bid_requirements_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_requirements" ADD CONSTRAINT "bid_requirements_bid_id_bids_id_fk" FOREIGN KEY ("bid_id") REFERENCES "public"."bids"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bid_requirements" ADD CONSTRAINT "bid_requirements_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bids" ADD CONSTRAINT "bids_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_facts" ADD CONSTRAINT "company_facts_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "company_facts" ADD CONSTRAINT "company_facts_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_docs" ADD CONSTRAINT "library_docs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "library_docs" ADD CONSTRAINT "library_docs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bid_credits_organization_id_idx" ON "bid_credits" USING btree ("organization_id","consumed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "bid_credits_external_ref_key" ON "bid_credits" USING btree ("external_ref");--> statement-breakpoint
CREATE UNIQUE INDEX "bid_credits_free_brief_key" ON "bid_credits" USING btree ("organization_id") WHERE "bid_credits"."kind" = 'free_brief';--> statement-breakpoint
CREATE INDEX "bid_files_bid_id_idx" ON "bid_files" USING btree ("bid_id","sort_order");--> statement-breakpoint
CREATE INDEX "bid_files_organization_id_idx" ON "bid_files" USING btree ("organization_id");--> statement-breakpoint
CREATE UNIQUE INDEX "bid_files_storage_key_key" ON "bid_files" USING btree ("storage_key");--> statement-breakpoint
CREATE INDEX "bid_questions_bid_id_idx" ON "bid_questions" USING btree ("bid_id","sort_order");--> statement-breakpoint
CREATE INDEX "bid_questions_organization_id_idx" ON "bid_questions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bid_requirements_bid_id_idx" ON "bid_requirements" USING btree ("bid_id","sort_order");--> statement-breakpoint
CREATE INDEX "bid_requirements_organization_id_idx" ON "bid_requirements" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "bids_organization_id_created_at_idx" ON "bids" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "bids_organization_id_status_idx" ON "bids" USING btree ("organization_id","status");--> statement-breakpoint
CREATE INDEX "bids_notice_id_idx" ON "bids" USING btree ("notice_id");--> statement-breakpoint
CREATE INDEX "library_docs_organization_id_created_at_idx" ON "library_docs" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "library_docs_storage_key_key" ON "library_docs" USING btree ("storage_key");