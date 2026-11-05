ALTER TABLE "proof_photos" DROP CONSTRAINT "proof_photos_compress_attempts_range";--> statement-breakpoint
DROP INDEX "proof_photos_compress_queue";--> statement-breakpoint
ALTER TABLE "proof_photos" DROP COLUMN "compressed_at";--> statement-breakpoint
ALTER TABLE "proof_photos" DROP COLUMN "compress_attempts";--> statement-breakpoint
ALTER TABLE "proof_photos" DROP COLUMN "compress_tried_at";