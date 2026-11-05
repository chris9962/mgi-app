import { afterAll, describe, expect, test } from "bun:test";
import { Pool } from "pg";

import "./helpers";
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
afterAll(() => pool.end());

const count = async (table: string) => Number((await pool.query(`select count(*) from ${table}`)).rows[0].count);

describe("seed tỉnh, xã", () => {
  test("34 tỉnh và 3.321 xã", async () => {
    expect(await count("provinces")).toBe(34);
    expect(await count("wards")).toBe(3321);
  });

  test("xã 25585 là Xã Châu Thành thuộc tỉnh 80", async () => {
    const { rows } = await pool.query("select name, province_code from wards where code = '25585'");
    expect(rows).toEqual([{ name: "Xã Châu Thành", province_code: "80" }]);
  });

  test("không tên xã nào chứa ký tự xuống dòng hay khoảng trắng thừa", async () => {
    const { rows } = await pool.query("select code from wards where name ~ '\\s{2,}|\\n' or name <> btrim(name)");
    expect(rows).toEqual([]);
  });
});
