CREATE TABLE "notification_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"kind" text NOT NULL,
	"period_key" text NOT NULL,
	"status" text NOT NULL,
	"item_count" integer DEFAULT 0 NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"as_of" timestamp with time zone NOT NULL,
	"sent_at" timestamp with time zone,
	"outbox_id" uuid,
	"detail" text,
	"clicked" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"first_clicked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_prefs" (
	"user_id" text NOT NULL,
	"organization_id" text NOT NULL,
	"weekly_digest" boolean DEFAULT true NOT NULL,
	"daily_alerts" boolean DEFAULT true NOT NULL,
	"deadline_reminders" boolean DEFAULT true NOT NULL,
	"product_emails" boolean DEFAULT true NOT NULL,
	"renewal_reminders" boolean DEFAULT true NOT NULL,
	"unsubscribed_all_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notification_prefs_user_id_organization_id_pk" PRIMARY KEY("user_id","organization_id")
);
--> statement-breakpoint
ALTER TABLE "email_outbox" ADD COLUMN "headers" jsonb;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_log" ADD CONSTRAINT "notification_log_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification_prefs" ADD CONSTRAINT "notification_prefs_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "notification_log_user_org_kind_period_key" ON "notification_log" USING btree ("user_id","organization_id","kind","period_key");--> statement-breakpoint
CREATE INDEX "notification_log_organization_idx" ON "notification_log" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "notification_log_created_at_idx" ON "notification_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "notification_log_sent_at_idx" ON "notification_log" USING btree ("sent_at") WHERE "notification_log"."status" = 'sent';--> statement-breakpoint
CREATE INDEX "notification_prefs_organization_idx" ON "notification_prefs" USING btree ("organization_id");