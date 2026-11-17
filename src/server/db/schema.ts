import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  check,
  index,
  inet,
  integer,
  numeric,
  pgEnum,
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { jsonb } from "./jsonb";

const id = () => uuid("id").primaryKey().defaultRandom();
const serialId = () => bigint("id", { mode: "number" }).primaryKey().generatedAlwaysAsIdentity();
const at = (name: string) => timestamp(name, { withTimezone: true });
const createdAt = () => at("created_at").notNull().defaultNow();

export const customerStatus = pgEnum("customer_status", ["new", "banks_selected", "pending_review", "reviewed", "no_bank"]);
export const customerBankStatus = pgEnum("customer_bank_status", ["selected", "pending", "passed", "failed"]);
export const reviewResult = pgEnum("review_result", ["passed", "failed"]);
export const photoCheckStatus = pgEnum("photo_check_status", ["pending", "done", "failed"]);
export const smsStatus = pgEnum("sms_status", ["queued", "sent", "failed"]);
export const userRole = pgEnum("user_role", ["admin", "manager", "staff"]);
export const permission = pgEnum("permission", ["manage_banks", "export_excel", "schools", "vouchers"]);

/* Danh mục hành chính */

export const provinces = pgTable("provinces", {
  code: text("code").primaryKey(),
  name: text("name").notNull(),
});

export const wards = pgTable(
  "wards",
  {
    code: text("code").primaryKey(),
    provinceCode: text("province_code")
      .notNull()
      .references(() => provinces.code),
    name: text("name").notNull(),
  },
  (t) => [index("wards_province").on(t.provinceCode)],
);

/* Nhân viên và đăng nhập */

export const users = pgTable(
  "users",
  {
    id: id(),
    username: text("username").notNull().unique(),
    staffCode: text("staff_code").unique(),
    passwordHash: text("password_hash").notNull(),
    fullName: text("full_name").notNull(),
    phone: text("phone"),
    role: userRole("role").notNull().default("staff"),
    title: text("title").notNull().default(""),
    active: boolean("active").notNull().default(true),
    failedAttempts: smallint("failed_attempts").notNull().default(0),
    lockedUntil: at("locked_until"),
    createdAt: createdAt(),
    updatedAt: at("updated_at").notNull().defaultNow(),
  },
  (t) => [check("users_username_lower", sql`${t.username} = lower(${t.username})`)],
);

export const userPermissions = pgTable(
  "user_permissions",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    permission: permission("permission").notNull(),
  },
  (t) => [primaryKey({ columns: [t.userId, t.permission] })],
);

export const sessions = pgTable(
  "sessions",
  {
    id: id(),
    tokenHash: text("token_hash").notNull().unique(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expiresAt: at("expires_at").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("sessions_user").on(t.userId)],
);

export const auditLog = pgTable(
  "audit_log",
  {
    id: serialId(),
    userId: uuid("user_id").references(() => users.id),
    action: text("action").notNull(),
    targetType: text("target_type").notNull(),
    targetId: text("target_id").notNull(),
    detail: jsonb("detail"),
    ip: inet("ip"),
    createdAt: createdAt(),
  },
  (t) => [index("audit_log_target").on(t.targetId, t.createdAt)],
);

/* Ngân hàng, mã giới thiệu, trường */

export const banks = pgTable("banks", {
  id: id(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  guide: jsonb("guide").notNull().default([]),
  sortOrder: smallint("sort_order").notNull().default(0),
  active: boolean("active").notNull().default(true),
  logoKey: text("logo_key"),
});

export const userManagedBanks = pgTable(
  "user_managed_banks",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id),
  },
  (t) => [primaryKey({ columns: [t.userId, t.bankId] }), index("user_managed_banks_bank").on(t.bankId)],
);

export const bankPhotoSlots = pgTable(
  "bank_photo_slots",
  {
    id: id(),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id),
    name: text("name").notNull(),
    sampleKey: text("sample_key"),
    checkName: boolean("check_name").notNull().default(false),
    checkCode: boolean("check_code").notNull().default(false),
    sortOrder: smallint("sort_order").notNull().default(0),
    removedAt: at("removed_at"),
  },
  (t) => [index("bank_photo_slots_bank").on(t.bankId)],
);

export const schools = pgTable("schools", {
  id: id(),
  name: text("name").notNull(),
  wardCode: text("ward_code")
    .notNull()
    .references(() => wards.code),
  contactName: text("contact_name").notNull(),
  contactPhone: text("contact_phone").notNull(),
  active: boolean("active").notNull().default(true),
  createdBy: uuid("created_by").references(() => users.id),
  createdAt: createdAt(),
});

export const referralCodes = pgTable(
  "referral_codes",
  {
    id: id(),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id),
    displayName: text("display_name").notNull(),
    code: text("code"),
    qrKey: text("qr_key"),
    openUrl: text("open_url"),
    monthlyQuota: integer("monthly_quota").notNull(),
    priority: smallint("priority").notNull().default(0),
    active: boolean("active").notNull().default(true),
    createdBy: uuid("created_by").references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("referral_codes_bank_display_name").on(t.bankId, t.displayName),
    check("referral_codes_monthly_quota_positive", sql`${t.monthlyQuota} > 0`),
    check("referral_codes_code_or_qr", sql`${t.code} is not null or ${t.qrKey} is not null`),
  ],
);

export const referralCodeMonths = pgTable(
  "referral_code_months",
  {
    referralCodeId: uuid("referral_code_id")
      .notNull()
      .references(() => referralCodes.id),
    yearMonth: text("year_month").notNull(),
    quota: integer("quota").notNull(),
  },
  (t) => [
    primaryKey({ columns: [t.referralCodeId, t.yearMonth] }),
    check("referral_code_months_year_month_format", sql`${t.yearMonth} ~ '^[0-9]{4}-[0-9]{2}$'`),
    check("referral_code_months_quota_positive", sql`${t.quota} > 0`),
  ],
);

export const referralCodeSchools = pgTable(
  "referral_code_schools",
  {
    referralCodeId: uuid("referral_code_id")
      .notNull()
      .references(() => referralCodes.id),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
  },
  (t) => [primaryKey({ columns: [t.referralCodeId, t.schoolId] }), index("referral_code_schools_school").on(t.schoolId)],
);

/* Học sinh */

export const customers = pgTable(
  "customers",
  {
    id: id(),
    schoolId: uuid("school_id")
      .notNull()
      .references(() => schools.id),
    fullName: text("full_name").notNull(),
    nameSearch: text("name_search").notNull(),
    className: text("class_name").notNull(),
    parentPhone: text("parent_phone").notNull(),
    status: customerStatus("status").notNull().default("new"),
    tokenHash: text("token_hash").notNull().unique(),
    submittedAt: at("submitted_at"),
    firstPassedAt: at("first_passed_at"),
    createdIp: inet("created_ip"),
    consentAt: at("consent_at"),
    consentVersion: text("consent_version"),
    lastSeenAt: at("last_seen_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("customers_school_created").on(t.schoolId, t.createdAt.desc()),
    index("customers_parent_phone").on(t.parentPhone),
    index("customers_name_search_trgm").using("gin", t.nameSearch.op("gin_trgm_ops")),
    check("customers_parent_phone_format", sql`${t.parentPhone} ~ '^0[0-9]{9}$'`),
  ],
);

export const customerExistingBanks = pgTable(
  "customer_existing_banks",
  {
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id),
  },
  (t) => [primaryKey({ columns: [t.customerId, t.bankId] })],
);

export const customerBanks = pgTable(
  "customer_banks",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    bankId: uuid("bank_id")
      .notNull()
      .references(() => banks.id),
    slot: smallint("slot").notNull(),
    referralCodeId: uuid("referral_code_id")
      .notNull()
      .references(() => referralCodes.id),
    referralCode: text("referral_code").notNull().default(""),
    yearMonth: text("year_month").notNull(),
    status: customerBankStatus("status").notNull().default("selected"),
    submittedAt: at("submitted_at"),
    reviewedAt: at("reviewed_at"),
    reviewedBy: uuid("reviewed_by").references(() => users.id),
    note: text("note").notNull().default(""),
  },
  (t) => [
    uniqueIndex("customer_banks_customer_bank").on(t.customerId, t.bankId),
    uniqueIndex("customer_banks_customer_slot").on(t.customerId, t.slot),
    index("customer_banks_queue").on(t.bankId, t.status, t.submittedAt),
    index("customer_banks_code_month").on(t.referralCodeId, t.yearMonth),
    check("customer_banks_slot_range", sql`${t.slot} in (1, 2)`),
    check("customer_banks_year_month_format", sql`${t.yearMonth} ~ '^[0-9]{4}-[0-9]{2}$'`),
  ],
);

export const proofPhotos = pgTable(
  "proof_photos",
  {
    id: id(),
    // Quay lại từ B3 xoá dòng ngân hàng, ảnh của dòng đó đi theo.
    customerBankId: uuid("customer_bank_id")
      .notNull()
      .references(() => customerBanks.id, { onDelete: "cascade" }),
    slotId: uuid("slot_id")
      .notNull()
      .references(() => bankPhotoSlots.id),
    s3Key: text("s3_key").notNull().unique(),
    sizeBytes: integer("size_bytes"),
    uploadedBy: uuid("uploaded_by").references(() => users.id),
    replacedAt: at("replaced_at"),
    createdAt: createdAt(),
  },
  (t) => [
    // Chỉ mục riêng phần trên không dùng được cho cascade khi xoá dòng ngân hàng.
    index("proof_photos_customer_bank").on(t.customerBankId),
    uniqueIndex("proof_photos_one_per_slot")
      .on(t.customerBankId, t.slotId)
      .where(sql`${t.replacedAt} is null`),
  ],
);

/* Hậu kiểm, voucher, SMS */

export const reviewEvents = pgTable(
  "review_events",
  {
    id: serialId(),
    customerBankId: uuid("customer_bank_id")
      .notNull()
      .references(() => customerBanks.id),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    result: reviewResult("result").notNull(),
    previousResult: reviewResult("previous_result"),
    createdAt: createdAt(),
  },
  (t) => [index("review_events_customer_bank").on(t.customerBankId)],
);

export const photoChecks = pgTable(
  "photo_checks",
  {
    id: id(),
    customerBankId: uuid("customer_bank_id")
      .notNull()
      .references(() => customerBanks.id, { onDelete: "cascade" }),
    status: photoCheckStatus("status").notNull().default("pending"),
    result: jsonb("result"),
    passed: smallint("passed").notNull().default(0),
    total: smallint("total").notNull().default(0),
    error: text("error").notNull().default(""),
    createdAt: createdAt(),
    checkedAt: at("checked_at"),
    // Lúc worker nhận lượt; worker khác bỏ qua lượt đang được giữ, worker chết giữa chừng thì quá hạn giữ là lấy lại được.
    claimedAt: at("claimed_at"),
    // Số lần worker nhận lượt: worker chết giữa chừng (hết RAM với ảnh HEIC lớn) thì lượt không được nhận lại mãi.
    claims: smallint("claims").notNull().default(0),
  },
  (t) => [
    index("photo_checks_queue")
      .on(t.createdAt)
      .where(sql`${t.status} = 'pending'`),
    index("photo_checks_latest").on(t.customerBankId, t.createdAt.desc()),
    uniqueIndex("photo_checks_one_pending")
      .on(t.customerBankId)
      .where(sql`${t.status} = 'pending'`),
  ],
);

export const smsMessages = pgTable(
  "sms_messages",
  {
    id: id(),
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id),
    kind: text("kind").notNull(),
    toPhone: text("to_phone").notNull(),
    body: text("body").notNull(),
    status: smsStatus("status").notNull().default("queued"),
    attempts: smallint("attempts").notNull().default(0),
    providerMessageId: text("provider_message_id"),
    error: text("error").notNull().default(""),
    sentAt: at("sent_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("sms_messages_customer_kind").on(t.customerId, t.kind),
    index("sms_messages_queue").on(t.status, t.createdAt),
    check("sms_messages_attempts_range", sql`${t.attempts} between 0 and 3`),
    // Một học sinh một tin theo unique (customer_id, kind): kind lạ sẽ lọt qua unique đó.
    check("sms_messages_kind", sql`${t.kind} in ('voucher')`),
  ],
);

export const vouchers = pgTable("vouchers", {
  id: id(),
  code: text("code").notNull().unique(),
  customerId: uuid("customer_id")
    .notNull()
    .unique()
    .references(() => customers.id),
  issuedAt: at("issued_at").notNull().defaultNow(),
});

/* Hệ thống */

export const settings = pgTable("settings", {
  key: text("key").primaryKey(),
  value: jsonb("value").notNull(),
  updatedBy: uuid("updated_by").references(() => users.id),
  updatedAt: at("updated_at").notNull().defaultNow(),
});

export const hostMetrics = pgTable(
  "host_metrics",
  {
    id: serialId(),
    at: at("at").notNull().defaultNow(),
    cpuPercent: numeric("cpu_percent", { precision: 5, scale: 2 }).notNull(),
    ramUsed: bigint("ram_used", { mode: "number" }).notNull(),
    ramTotal: bigint("ram_total", { mode: "number" }).notNull(),
    diskUsed: bigint("disk_used", { mode: "number" }).notNull(),
    diskTotal: bigint("disk_total", { mode: "number" }).notNull(),
    s3Bytes: bigint("s3_bytes", { mode: "number" }),
    s3Objects: bigint("s3_objects", { mode: "number" }),
    s3At: at("s3_at"),
  },
  (t) => [index("host_metrics_at").on(t.at.desc())],
);
