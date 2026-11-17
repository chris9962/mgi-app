ALTER TABLE "customers" DROP CONSTRAINT "customers_phone_format";--> statement-breakpoint
ALTER TABLE "customers" DROP CONSTRAINT "customers_phone_differs";--> statement-breakpoint
DROP INDEX "customers_phone";--> statement-breakpoint
ALTER TABLE "customers" DROP COLUMN "phone";