CREATE EXTENSION IF NOT EXISTS unaccent;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_kind" CHECK ("sms_messages"."kind" in ('voucher'));