CREATE TABLE "billing_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"paddle_transaction_id" text NOT NULL,
	"paddle_subscription_id" text,
	"kind" text NOT NULL,
	"plan_key" text,
	"billing_interval" text,
	"product" text,
	"price_id" text,
	"quantity" integer DEFAULT 1 NOT NULL,
	"subtotal_minor" bigint NOT NULL,
	"tax_minor" bigint NOT NULL,
	"total_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"invoice_number" text,
	"status" text DEFAULT 'completed' NOT NULL,
	"payment_method" jsonb,
	"paid_at" timestamp with time zone NOT NULL,
	"paddle_environment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "billing_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text,
	"kind" text NOT NULL,
	"paddle_transaction_id" text NOT NULL,
	"price_id" text NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"amount_minor" bigint NOT NULL,
	"currency" text NOT NULL,
	"status" text DEFAULT 'completed' NOT NULL,
	"fulfilled_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"paddle_environment" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"raw" jsonb
);
--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "pause_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "paddle_environment" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "payment_method" jsonb;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "payment_method_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD COLUMN "environment" text;--> statement-breakpoint
ALTER TABLE "billing_payments" ADD CONSTRAINT "billing_payments_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_purchases" ADD CONSTRAINT "billing_purchases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "billing_purchases" ADD CONSTRAINT "billing_purchases_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "billing_payments_paddle_transaction_id_key" ON "billing_payments" USING btree ("paddle_transaction_id");--> statement-breakpoint
CREATE INDEX "billing_payments_organization_id_paid_at_idx" ON "billing_payments" USING btree ("organization_id","paid_at");--> statement-breakpoint
CREATE INDEX "billing_payments_paddle_subscription_id_idx" ON "billing_payments" USING btree ("paddle_subscription_id","paid_at");--> statement-breakpoint
CREATE UNIQUE INDEX "billing_purchases_paddle_transaction_id_key" ON "billing_purchases" USING btree ("paddle_transaction_id");--> statement-breakpoint
CREATE INDEX "billing_purchases_organization_id_created_at_idx" ON "billing_purchases" USING btree ("organization_id","created_at");--> statement-breakpoint
CREATE INDEX "webhook_events_adjustment_transaction_idx" ON "webhook_events" USING btree ((("payload" -> 'data' ->> 'transaction_id'))) WHERE "webhook_events"."event_type" like 'adjustment.%';