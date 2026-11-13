CREATE TABLE "billing_checkout_nonces" (
	"nonce" text PRIMARY KEY NOT NULL,
	"organization_id" text NOT NULL,
	"user_id" text NOT NULL,
	"paddle_subscription_id" text NOT NULL,
	"consumed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "reserved_usd" numeric(12, 6);--> statement-breakpoint
ALTER TABLE "ai_usage" ADD COLUMN "plan_key" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "checkout_user_id" text;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD COLUMN "reconciled_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "billing_checkout_nonces" ADD CONSTRAINT "billing_checkout_nonces_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "billing_checkout_nonces_organization_id_idx" ON "billing_checkout_nonces" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "ai_usage_reserved_idx" ON "ai_usage" USING btree ("created_at") WHERE "ai_usage"."status" = 'reserved';--> statement-breakpoint
CREATE INDEX "webhook_events_data_id_idx" ON "webhook_events" USING btree ((("payload" -> 'data' ->> 'id')),"occurred_at");