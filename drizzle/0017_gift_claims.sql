CREATE TABLE "gift_claims" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"bank_id" uuid NOT NULL,
	"account_number" text NOT NULL,
	"account_name" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone,
	"paid_by" uuid,
	CONSTRAINT "gift_claims_customer_id_unique" UNIQUE("customer_id"),
	CONSTRAINT "gift_claims_account_number_format" CHECK ("gift_claims"."account_number" ~ '^[0-9]{6,20}$')
);
--> statement-breakpoint
ALTER TABLE "gift_claims" ADD CONSTRAINT "gift_claims_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_claims" ADD CONSTRAINT "gift_claims_bank_id_banks_id_fk" FOREIGN KEY ("bank_id") REFERENCES "public"."banks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gift_claims" ADD CONSTRAINT "gift_claims_paid_by_users_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;