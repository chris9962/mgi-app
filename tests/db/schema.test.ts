import { afterAll, describe, expect, test } from "bun:test";
import { Pool } from "pg";

import "./helpers";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(() => pool.end());

const TABLES = [
  "audit_log", "bank_photo_slots", "banks", "customer_banks", "customer_existing_banks", "customers",
  "host_metrics", "photo_checks", "proof_photos", "provinces", "referral_code_months", "referral_code_schools",
  "referral_codes", "review_events", "schools", "sessions", "settings", "sms_messages", "user_managed_banks",
  "user_permissions", "users", "vouchers", "wards",
];

describe("schema", () => {
  test("có đúng 23 bảng trong public", async () => {
    const { rows } = await pool.query(
      "select table_name from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1",
    );
    expect(rows.map((r) => r.table_name)).toEqual(TABLES);
  });

  test("có extension pg_trgm", async () => {
    const { rowCount } = await pool.query("select 1 from pg_extension where extname = 'pg_trgm'");
    expect(rowCount).toBe(1);
  });

  test("mỗi khung ngân hàng chỉ một ảnh đang dùng", async () => {
    const { rows } = await pool.query(
      "select indexdef from pg_indexes where tablename = 'proof_photos' and indexdef like '%UNIQUE%slot_id%'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain("replaced_at IS NULL");
  });

  test("ảnh tra được theo dòng ngân hàng bằng chỉ mục đầy đủ", async () => {
    const { rows } = await pool.query(
      "select indexdef from pg_indexes where tablename = 'proof_photos' and indexdef like '%(customer_bank_id)' and indexdef not like '%WHERE%'",
    );
    expect(rows).toHaveLength(1);
  });

  test("tìm tên dùng GIN trigram", async () => {
    const { rows } = await pool.query(
      "select indexdef from pg_indexes where tablename = 'customers' and indexdef like '%gin%name_search%'",
    );
    expect(rows).toHaveLength(1);
    expect(rows[0].indexdef).toContain("gin_trgm_ops");
  });

  test("số lượt mỗi tháng phải lớn hơn 0", async () => {
    const { rows } = await pool.query(
      "select pg_get_constraintdef(oid) as def from pg_constraint where conrelid = 'referral_codes'::regclass and contype = 'c'",
    );
    expect(rows.map((r) => r.def).join(" ")).toContain("monthly_quota > 0");
  });
});
