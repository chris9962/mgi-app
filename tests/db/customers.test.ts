import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { TEST_NAME, cleanTestUsers, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { customerBanks, customerExistingBanks, customers } from "../../src/server/db/schema";
import { createBank, setBankActive } from "../../src/server/banks";
import { createSchool, setSchoolActive } from "../../src/server/schools";
import { createCode, setCodeActive } from "../../src/server/referralCodes";
import { createCustomer, customerFromRequest, openBanksAtSchool, programBanksAtSchool } from "../../src/server/customers";
import { BankForm } from "../../src/lib/bankForm";
import { CodeForm } from "../../src/lib/codeForm";
import { CONSENT_VERSION } from "../../src/lib/consent";
import { CustomerForm } from "../../src/lib/customerForm";
import { SchoolForm } from "../../src/lib/schoolForm";
import { currentYearMonth } from "../../src/lib/month";
import type { SessionUser } from "../../src/lib/types";

const MONTH = currentYearMonth();
let manager: SessionUser;
let schoolId: string;
let emptySchoolId: string;
const bank: Record<string, string> = {};

const school = async (name: string) => {
  const r = await createSchool(manager, SchoolForm.parse({ name: TEST_NAME + name, provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903111222" }));
  if (!r.ok) throw new Error(r.message);
  return r.id;
};
const addBank = async (key: string, sortOrder: number) => {
  const r = await createBank(manager, BankForm.parse({ code: "ZZB1" + key, name: TEST_NAME + "B1 " + key, sortOrder: String(sortOrder), managerIds: [] }));
  if (!r.ok) throw new Error(r.message);
  bank[key] = r.id;
};
const addCode = async (bankKey: string, name: string, schoolIds: string[], quota = 10) => {
  const r = await createCode(manager, CodeForm.parse({ bankId: bank[bankKey], displayName: TEST_NAME + name, code: name, qrKey: null, openUrl: "", monthlyQuota: String(quota), priority: "0", schoolIds }));
  if (!r.ok) throw new Error(r.message);
  return r.id;
};

const form = (extra: Record<string, unknown> = {}) => ({
  schoolId,
  fullName: "  Trần   Minh Anh ",
  className: "11 a3",
  phone: "0912 345 678",
  parentName: "Trần Văn Hùng",
  parentPhone: "0987654321",
  consent: true, existingBankIds: [],
  ...extra,
});

beforeAll(async () => {
  await cleanTestUsers();
  manager = await makeActor("b1_manager", "manager");
  schoolId = await school("THPT B1");
  emptySchoolId = await school("THPT B1 trống");
  await addBank("MB", 1);
  await addBank("VPB", 2);
  await addBank("OFF", 3);
  await addBank("STOP", 4);
  await addBank("FAR", 5);
  await addCode("MB", "B1-MB", [schoolId]);
  await addCode("VPB", "B1-VPB", [schoolId]);
  await addCode("OFF", "B1-OFF", [schoolId]);
  await setBankActive(manager, bank.OFF, false);
  await setCodeActive(manager, await addCode("STOP", "B1-STOP", [schoolId]), false);
  await addCode("FAR", "B1-FAR", [await school("THPT B1 xa")]);
  await addBank("FULL", 6);
  const full = await addCode("FULL", "B1-FULL", [schoolId], 1);
  const [holder] = await db
    .insert(customers)
    .values({ schoolId, fullName: "HS", nameSearch: "hs", className: "10A1", phone: "0900000101", parentName: "PH", parentPhone: "0910000101", tokenHash: "zz-b1-full" })
    .returning({ id: customers.id });
  await db.insert(customerBanks).values({ customerId: holder.id, bankId: bank.FULL, slot: 1, referralCodeId: full, referralCode: "B1-FULL", yearMonth: MONTH });
});
afterAll(cleanTestUsers);

describe("ngân hàng mở ở trường", () => {
  test("chỉ ngân hàng đang mở có mã đang dùng còn lượt gắn cho trường, xếp theo thứ tự", async () => {
    expect((await openBanksAtSchool(schoolId, MONTH)).map((b) => b.id)).toEqual([bank.MB, bank.VPB]);
    expect(await openBanksAtSchool(emptySchoolId, MONTH)).toEqual([]);
  });

  test("B1 hỏi ngân hàng đã có trên mọi ngân hàng của chương trình ở trường, kể cả ngân hàng hết lượt", async () => {
    expect((await programBanksAtSchool(schoolId, MONTH)).map((b) => b.id)).toEqual([bank.MB, bank.VPB, bank.FULL]);
    expect(await programBanksAtSchool(emptySchoolId, MONTH)).toEqual([]);
  });
});

describe("B1 khai thông tin", () => {
  test("dữ liệu sai bị từ chối", () => {
    const fails = (extra: Record<string, unknown>) => CustomerForm.safeParse(form(extra)).success === false;
    expect(fails({ fullName: " " })).toBe(true);
    expect(fails({ className: "  " })).toBe(true);
    expect(fails({ parentName: "" })).toBe(true);
    expect(fails({ phone: "091234567" })).toBe(true);
    expect(fails({ phone: "1912345678" })).toBe(true);
    expect(fails({ parentPhone: "09876543210" })).toBe(true);
    expect(fails({ parentPhone: "0912345678" })).toBe(true);
    expect(fails({ existingBankIds: ["x"] })).toBe(true);
    expect(fails({ schoolId: "abc" })).toBe(true);
  });

  test("SĐT trùng nhau báo ở ô SĐT phụ huynh", () => {
    const r = CustomerForm.safeParse(form({ parentPhone: "0912345678" }));
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["parentPhone"]);
  });

  test("lưu hồ sơ: lớp viết hoa bỏ khoảng trắng, họ tên gọn khoảng trắng, name_search bỏ dấu, ngân hàng đã có, IP", async () => {
    const r = await createCustomer(CustomerForm.parse(form({ existingBankIds: [bank.MB] })), "203.0.113.7");
    if (!r.ok) throw new Error(r.message);
    const [row] = await db.select().from(customers).where(eq(customers.id, r.id));
    expect(row).toMatchObject({ fullName: "Trần Minh Anh", className: "11A3", nameSearch: "tran minh anh", phone: "0912345678", parentPhone: "0987654321", status: "new", createdIp: "203.0.113.7" });
    expect(row.consentVersion).toBe(CONSENT_VERSION);
    expect(row.consentAt).toBeInstanceOf(Date);
    expect((await db.select().from(customerExistingBanks).where(eq(customerExistingBanks.customerId, r.id))).map((x) => x.bankId)).toEqual([bank.MB]);
    const found = await customerFromRequest(new Request("http://bank.localhost", { headers: { Authorization: `Bearer ${r.token}` } }));
    expect(found?.id).toBe(r.id);
  });

  test("đã có mọi ngân hàng của chương trình ở trường, kể cả ngân hàng hết lượt, thì hồ sơ là no_bank", async () => {
    const r = await createCustomer(CustomerForm.parse(form({ existingBankIds: [bank.MB, bank.VPB, bank.FULL] })), null);
    if (!r.ok) throw new Error(r.message);
    const [row] = await db.select({ status: customers.status }).from(customers).where(eq(customers.id, r.id));
    expect(row.status).toBe("no_bank");
  });

  test("ngân hàng chưa có chỉ đang hết lượt thì hồ sơ vẫn là new", async () => {
    const r = await createCustomer(CustomerForm.parse(form({ existingBankIds: [bank.MB, bank.VPB] })), null);
    if (!r.ok) throw new Error(r.message);
    const [row] = await db.select({ status: customers.status }).from(customers).where(eq(customers.id, r.id));
    expect(row.status).toBe("new");
  });

  test("trường không có hoặc đã đóng thì không tạo hồ sơ", async () => {
    expect(await createCustomer(CustomerForm.parse(form({ schoolId: "00000000-0000-4000-8000-000000000000" })), null)).toMatchObject({ ok: false, status: 404 });
    const closed = await school("THPT B1 đóng");
    await setSchoolActive(manager, closed, false);
    expect(await createCustomer(CustomerForm.parse(form({ schoolId: closed })), null)).toMatchObject({ ok: false, status: 409 });
  });

  test("ngân hàng đã có không tồn tại thì từ chối", async () => {
    expect(await createCustomer(CustomerForm.parse(form({ existingBankIds: ["00000000-0000-4000-8000-000000000000"] })), null)).toMatchObject({ ok: false, field: "existingBankIds" });
  });
});
