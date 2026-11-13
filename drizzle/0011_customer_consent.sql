ALTER TABLE "customers" ADD COLUMN "consent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "customers" ADD COLUMN "consent_version" text;