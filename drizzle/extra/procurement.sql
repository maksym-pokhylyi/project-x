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
