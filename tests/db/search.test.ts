import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { TEST_NAME, TEST_PREFIX, cleanTestUsers } from "./helpers";
import { setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { schools, users } from "../../src/server/db/schema";
import { listSchools, searchSchoolOptions } from "../../src/server/schools";
import { listCodes } from "../../src/server/referralCodes";
import { managerOptions } from "../../src/server/banks";
import { listUsers } from "../../src/server/users";

let p: Program;

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("search", ["A"]);
  await db.insert(schools).values({ name: `${TEST_NAME}THPT Nguyễn Đình Chiểu`, wardCode: "25585", contactName: "A", contactPhone: "0903111222" });
  await db.insert(schools).values({ name: `${TEST_NAME}THPT 100% Đức`, wardCode: "25585", contactName: "A", contactPhone: "0903111222" });
  await db.insert(users).values({ username: `${TEST_PREFIX}search_hoa`, fullName: "Trần Thị Hoà Searchds", passwordHash: "x", role: "staff" });
});
afterAll(cleanTestUsers);

describe("ô tìm không phân biệt dấu, ký tự % và _ là chữ thường", () => {
  test("Trường: tên trường và tên xã", async () => {
    expect((await listSchools({ q: "nguyen dinh chieu", page: 1 })).rows.map((r) => r.name)).toEqual([`${TEST_NAME}THPT Nguyễn Đình Chiểu`]);
    expect((await listSchools({ q: "ZZTEST THPT 100%", page: 1 })).rows.map((r) => r.name)).toEqual([`${TEST_NAME}THPT 100% Đức`]);
    expect((await listSchools({ q: "zztest%chieu", page: 1 })).total).toBe(0);
    expect((await listSchools({ q: "zztest_thpt", page: 1 })).total).toBe(0);
    expect((await searchSchoolOptions("zztest thpt nguyen dinh")).map((o) => o.label)).toEqual([`${TEST_NAME}THPT Nguyễn Đình Chiểu - Châu Thành`]);
  });

  test("Kho mã: tên hiển thị và mã", async () => {
    const codes = await listCodes(p.manager, { month: "2026-11", q: "zztest search", bankId: "", hideStopped: false, page: 1 });
    expect(codes.rows.map((r) => r.id)).toEqual([p.code.A]);
    expect((await listCodes(p.manager, { month: "2026-11", q: "search-%", bankId: "", hideStopped: false, page: 1 })).total).toBe(0);
  });

  test("ô chọn người quản và danh sách tài khoản", async () => {
    expect((await managerOptions("tran thi hoa searchds")).map((o) => o.label)).toEqual(["Trần Thị Hoà Searchds"]);
    expect((await listUsers({ q: "hoa searchds", page: 1 })).rows.map((r) => r.fullName)).toEqual(["Trần Thị Hoà Searchds"]);
    expect((await listUsers({ q: "zz\\_test%", page: 1 })).total).toBe(0);
    expect((await listUsers({ q: "hoa searchds", page: 1.5 })).page).toBe(1);
  });
});
