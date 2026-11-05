CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE TYPE "public"."customer_bank_status" AS ENUM('selected', 'pending', 'passed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."customer_status" AS ENUM('new', 'banks_selected', 'pending_review', 'reviewed', 'no_bank');--> statement-breakpoint
CREATE TYPE "public"."permission" AS ENUM('manage_banks', 'export_excel', 'schools', 'vouchers');--> statement-breakpoint
CREATE TYPE "public"."photo_check_status" AS ENUM('pending', 'done', 'failed');--> statement-breakpoint
CREATE TYPE "public"."review_result" AS ENUM('passed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."sms_status" AS ENUM('queued', 'sent', 'failed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('admin', 'manager', 'staff');--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "audit_log_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"user_id" uuid,
	"action" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" text NOT NULL,
	"detail" jsonb,
	"ip" "inet",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bank_photo_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_id" uuid NOT NULL,
	"name" text NOT NULL,
	"sample_key" text,
	"check_name" boolean DEFAULT false NOT NULL,
	"check_code" boolean DEFAULT false NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"removed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"guide" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "banks_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "customer_banks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"slot" smallint NOT NULL,
	"referral_code_id" uuid NOT NULL,
	"referral_code" text DEFAULT '' NOT NULL,
	"year_month" text NOT NULL,
	"status" "customer_bank_status" DEFAULT 'selected' NOT NULL,
	"submitted_at" timestamp with time zone,
	"reviewed_at" timestamp with time zone,
	"reviewed_by" uuid,
	"note" text DEFAULT '' NOT NULL,
	CONSTRAINT "customer_banks_slot_range" CHECK ("customer_banks"."slot" in (1, 2)),
	CONSTRAINT "customer_banks_year_month_format" CHECK ("customer_banks"."year_month" ~ '^[0-9]{4}-[0-9]{2}$')
);
--> statement-breakpoint
CREATE TABLE "customer_existing_banks" (
	"customer_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	CONSTRAINT "customer_existing_banks_customer_id_bank_id_pk" PRIMARY KEY("customer_id","bank_id")
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"school_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"name_search" text NOT NULL,
	"class_name" text NOT NULL,
	"phone" text NOT NULL,
	"parent_name" text NOT NULL,
	"parent_phone" text NOT NULL,
	"status" "customer_status" DEFAULT 'new' NOT NULL,
	"token_hash" text NOT NULL,
	"submitted_at" timestamp with time zone,
	"first_passed_at" timestamp with time zone,
	"created_ip" "inet",
	"last_seen_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "customers_token_hash_unique" UNIQUE("token_hash"),
	CONSTRAINT "customers_phone_format" CHECK ("customers"."phone" ~ '^0[0-9]{9}$'),
	CONSTRAINT "customers_parent_phone_format" CHECK ("customers"."parent_phone" ~ '^0[0-9]{9}$'),
	CONSTRAINT "customers_phone_differs" CHECK ("customers"."phone" <> "customers"."parent_phone")
);
--> statement-breakpoint
CREATE TABLE "host_metrics" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "host_metrics_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"cpu_percent" numeric(5, 2) NOT NULL,
	"ram_used" bigint NOT NULL,
	"ram_total" bigint NOT NULL,
	"disk_used" bigint NOT NULL,
	"disk_total" bigint NOT NULL,
	"s3_bytes" bigint,
	"s3_objects" bigint,
	"s3_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "photo_checks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_bank_id" uuid NOT NULL,
	"status" "photo_check_status" DEFAULT 'pending' NOT NULL,
	"result" jsonb,
	"passed" smallint DEFAULT 0 NOT NULL,
	"total" smallint DEFAULT 0 NOT NULL,
	"error" text DEFAULT '' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"checked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "proof_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_bank_id" uuid NOT NULL,
	"slot_id" uuid NOT NULL,
	"s3_key" text NOT NULL,
	"size_bytes" integer,
	"compressed_at" timestamp with time zone,
	"compress_attempts" smallint DEFAULT 0 NOT NULL,
	"uploaded_by" uuid,
	"replaced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "proof_photos_s3_key_unique" UNIQUE("s3_key"),
	CONSTRAINT "proof_photos_compress_attempts_range" CHECK ("proof_photos"."compress_attempts" between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE "provinces" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "referral_code_months" (
	"referral_code_id" uuid NOT NULL,
	"year_month" text NOT NULL,
	"quota" integer NOT NULL,
	CONSTRAINT "referral_code_months_referral_code_id_year_month_pk" PRIMARY KEY("referral_code_id","year_month"),
	CONSTRAINT "referral_code_months_year_month_format" CHECK ("referral_code_months"."year_month" ~ '^[0-9]{4}-[0-9]{2}$'),
	CONSTRAINT "referral_code_months_quota_positive" CHECK ("referral_code_months"."quota" > 0)
);
--> statement-breakpoint
CREATE TABLE "referral_code_schools" (
	"referral_code_id" uuid NOT NULL,
	"school_id" uuid NOT NULL,
	CONSTRAINT "referral_code_schools_referral_code_id_school_id_pk" PRIMARY KEY("referral_code_id","school_id")
);
--> statement-breakpoint
CREATE TABLE "referral_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"bank_id" uuid NOT NULL,
	"display_name" text NOT NULL,
	"code" text,
	"qr_key" text,
	"open_url" text,
	"monthly_quota" integer NOT NULL,
	"priority" smallint DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "referral_codes_monthly_quota_positive" CHECK ("referral_codes"."monthly_quota" > 0),
	CONSTRAINT "referral_codes_code_or_qr" CHECK ("referral_codes"."code" is not null or "referral_codes"."qr_key" is not null)
);
--> statement-breakpoint
CREATE TABLE "review_events" (
	"id" bigint PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "review_events_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 9223372036854775807 START WITH 1 CACHE 1),
	"customer_bank_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"result" "review_result" NOT NULL,
	"previous_result" "review_result",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schools" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"ward_code" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_phone" text NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	"remember" boolean DEFAULT false NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sms_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"kind" text NOT NULL,
	"to_phone" text NOT NULL,
	"body" text NOT NULL,
	"status" "sms_status" DEFAULT 'queued' NOT NULL,
	"attempts" smallint DEFAULT 0 NOT NULL,
	"provider_message_id" text,
	"error" text DEFAULT '' NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sms_messages_attempts_range" CHECK ("sms_messages"."attempts" between 0 and 3)
);
--> statement-breakpoint
CREATE TABLE "user_managed_banks" (
	"user_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	CONSTRAINT "user_managed_banks_user_id_bank_id_pk" PRIMARY KEY("user_id","bank_id")
);
--> statement-breakpoint
CREATE TABLE "user_permissions" (
	"user_id" uuid NOT NULL,
	"permission" "permission" NOT NULL,
	CONSTRAINT "user_permissions_user_id_permission_pk" PRIMARY KEY("user_id","permission")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" text NOT NULL,
	"staff_code" text,
	"password_hash" text NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"role" "user_role" DEFAULT 'staff' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"failed_attempts" smallint DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_staff_code_unique" UNIQUE("staff_code"),
	CONSTRAINT "users_username_lower" CHECK ("users"."username" = lower("users"."username"))
);
--> statement-breakpoint
CREATE TABLE "vouchers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"customer_id" uuid NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "vouchers_code_unique" UNIQUE("code"),
	CONSTRAINT "vouchers_customer_id_unique" UNIQUE("customer_id")
);
--> statement-breakpoint
CREATE TABLE "wards" (
	"code" text PRIMARY KEY NOT NULL,
	"province_code" text NOT NULL,
	"name" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bank_photo_slots" ADD CONSTRAINT "bank_photo_slots_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_banks" ADD CONSTRAINT "customer_banks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_banks" ADD CONSTRAINT "customer_banks_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_banks" ADD CONSTRAINT "customer_banks_referral_code_id_referral_codes_id_fk" FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_banks" ADD CONSTRAINT "customer_banks_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_existing_banks" ADD CONSTRAINT "customer_existing_banks_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customer_existing_banks" ADD CONSTRAINT "customer_existing_banks_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_checks" ADD CONSTRAINT "photo_checks_customer_bank_id_customer_banks_id_fk" FOREIGN KEY ("customer_bank_id") REFERENCES "public"."customer_banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_photos" ADD CONSTRAINT "proof_photos_customer_bank_id_customer_banks_id_fk" FOREIGN KEY ("customer_bank_id") REFERENCES "public"."customer_banks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_photos" ADD CONSTRAINT "proof_photos_slot_id_bank_photo_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."bank_photo_slots"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "proof_photos" ADD CONSTRAINT "proof_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_code_months" ADD CONSTRAINT "referral_code_months_referral_code_id_referral_codes_id_fk" FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_code_schools" ADD CONSTRAINT "referral_code_schools_referral_code_id_referral_codes_id_fk" FOREIGN KEY ("referral_code_id") REFERENCES "public"."referral_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_code_schools" ADD CONSTRAINT "referral_code_schools_school_id_schools_id_fk" FOREIGN KEY ("school_id") REFERENCES "public"."schools"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "referral_codes" ADD CONSTRAINT "referral_codes_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_customer_bank_id_customer_banks_id_fk" FOREIGN KEY ("customer_bank_id") REFERENCES "public"."customer_banks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "review_events" ADD CONSTRAINT "review_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_ward_code_wards_code_fk" FOREIGN KEY ("ward_code") REFERENCES "public"."wards"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schools" ADD CONSTRAINT "schools_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sms_messages" ADD CONSTRAINT "sms_messages_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_managed_banks" ADD CONSTRAINT "user_managed_banks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_managed_banks" ADD CONSTRAINT "user_managed_banks_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_permissions" ADD CONSTRAINT "user_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "vouchers" ADD CONSTRAINT "vouchers_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wards" ADD CONSTRAINT "wards_province_code_provinces_code_fk" FOREIGN KEY ("province_code") REFERENCES "public"."provinces"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "bank_photo_slots_bank" ON "bank_photo_slots" USING btree ("bank_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_banks_customer_bank" ON "customer_banks" USING btree ("customer_id","bank_id");--> statement-breakpoint
CREATE UNIQUE INDEX "customer_banks_customer_slot" ON "customer_banks" USING btree ("customer_id","slot");--> statement-breakpoint
CREATE INDEX "customer_banks_queue" ON "customer_banks" USING btree ("bank_id","status","submitted_at");--> statement-breakpoint
CREATE INDEX "customer_banks_code_month" ON "customer_banks" USING btree ("referral_code_id","year_month");--> statement-breakpoint
CREATE INDEX "customers_school_created" ON "customers" USING btree ("school_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "customers_phone" ON "customers" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "customers_parent_phone" ON "customers" USING btree ("parent_phone");--> statement-breakpoint
CREATE INDEX "customers_name_search_trgm" ON "customers" USING gin ("name_search" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "host_metrics_at" ON "host_metrics" USING btree ("at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "photo_checks_queue" ON "photo_checks" USING btree ("created_at") WHERE "photo_checks"."status" = 'pending';--> statement-breakpoint
CREATE INDEX "photo_checks_latest" ON "photo_checks" USING btree ("customer_bank_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "proof_photos_one_per_slot" ON "proof_photos" USING btree ("customer_bank_id","slot_id") WHERE "proof_photos"."replaced_at" is null;--> statement-breakpoint
CREATE INDEX "proof_photos_compress_queue" ON "proof_photos" USING btree ("created_at") WHERE "proof_photos"."compressed_at" is null;--> statement-breakpoint
CREATE INDEX "referral_code_schools_school" ON "referral_code_schools" USING btree ("school_id");--> statement-breakpoint
CREATE UNIQUE INDEX "referral_codes_bank_display_name" ON "referral_codes" USING btree ("bank_id","display_name");--> statement-breakpoint
CREATE INDEX "review_events_customer_bank" ON "review_events" USING btree ("customer_bank_id");--> statement-breakpoint
CREATE INDEX "sessions_user" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "sms_messages_customer_kind" ON "sms_messages" USING btree ("customer_id","kind");--> statement-breakpoint
CREATE INDEX "sms_messages_queue" ON "sms_messages" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX "user_managed_banks_bank" ON "user_managed_banks" USING btree ("bank_id");--> statement-breakpoint
CREATE INDEX "wards_province" ON "wards" USING btree ("province_code");