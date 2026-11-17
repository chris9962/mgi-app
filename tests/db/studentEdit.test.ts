import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { eq } from "drizzle-orm";
import { cleanTestUsers } from "./helpers";
import { setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { customerExistingBanks, customers } from "../../src/server/db/schema";
import { setSchoolActive } from "../../src/server/schools";
import { createCustomer, ownCustomerInfo, reserveBanks, updateOwnCustomer, type Customer } from "../../src/server/customers";
import { CustomerForm, CustomerSelfEditForm } from "../../src/lib/customerForm";

const MONTH = "2026-11";
let p: Program;
let phoneSeq = 700;

async function student(existingBankIds: string[] = []): Promise<Customer> {
  phoneSeq += 1;
  const r = await createCustomer(
    CustomerForm.parse({ schoolId: p.schoolId, fullName: "Học Sinh Sửa", className: "10A1", parentPhone: `0910000${phoneSeq}`, consent: true, existingBankIds }),
    null,
    MONTH,
  );
  if (!r.ok) throw new Error(r.message);
  return (await db.select().from(customers).where(eq(customers.id, r.id)))[0];
}
const fresh = async (c: Customer) => (await db.select().from(customers).where(eq(customers.id, c.id)))[0];
const edit = (over: Record<string, unknown> = {}) =>
  CustomerSelfEditForm.parse({ fullName: "  Tên   Mới ", className: "11 b2", parentPhone: "0910 000 799", existingBankIds: [], ...over });

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("edit", ["a", "b"]);
});
afterAll(cleanTestUsers);
beforeEach(async () => {
  await setSchoolActive(p.manager, p.schoolId, true);
});

describe("học sinh sửa thông tin trước khi gửi kiểm tra", () => {
  test("hồ sơ chưa chọn ngân hàng: đọc lại được thông tin đã khai và sửa được", async () => {
    const c = await student([p.bank.a]);
    expect(await ownCustomerInfo(c)).toMatchObject({ ok: true, info: { fullName: "Học Sinh Sửa", className: "10A1", parentPhone: c.parentPhone, existingBankIds: [p.bank.a] } });
    expect(await updateOwnCustomer(c, edit({ existingBankIds: [p.bank.b] }), MONTH)).toEqual({ ok: true });
    const after = await fresh(c);
    expect(after).toMatchObject({ fullName: "Tên Mới", nameSearch: "ten moi", className: "11B2", parentPhone: "0910000799", status: "new" });
    expect((await db.select().from(customerExistingBanks).where(eq(customerExistingBanks.customerId, c.id))).map((r) => r.bankId)).toEqual([p.bank.b]);
  });

  test("tick đủ ngân hàng thì thành no_bank, bỏ tick thì về new", async () => {
    const c = await student();
    expect(await updateOwnCustomer(c, edit({ existingBankIds: [p.bank.a, p.bank.b] }), MONTH)).toEqual({ ok: true });
    expect((await fresh(c)).status).toBe("no_bank");
    expect(await updateOwnCustomer(await fresh(c), edit(), MONTH)).toEqual({ ok: true });
    expect((await fresh(c)).status).toBe("new");
  });

  test("đã chọn ngân hàng hoặc đã gửi kiểm tra thì không sửa được", async () => {
    const c = await student();
    expect(await reserveBanks(c, [p.bank.a, p.bank.b], MONTH)).toEqual({ ok: true });
    expect(await updateOwnCustomer(c, edit(), MONTH)).toMatchObject({ ok: false, status: 409 });
    expect((await fresh(c)).fullName).toBe("Học Sinh Sửa");
    // Bước mở tài khoản vẫn đọc được thông tin: web đọc trước, xoá ngân hàng xong mới mở màn sửa.
    expect(await ownCustomerInfo(await fresh(c))).toMatchObject({ ok: true });
    await db.update(customers).set({ status: "pending_review" }).where(eq(customers.id, c.id));
    expect(await ownCustomerInfo(await fresh(c))).toMatchObject({ ok: false, status: 409 });
    expect(await updateOwnCustomer(c, edit(), MONTH)).toMatchObject({ ok: false, status: 409 });
  });

  test("trường đã đóng hoặc ngân hàng lạ thì từ chối", async () => {
    const c = await student();
    expect(await updateOwnCustomer(c, edit({ existingBankIds: [p.schoolId] }), MONTH)).toMatchObject({ ok: false, status: 400, field: "existingBankIds" });
    await setSchoolActive(p.manager, p.schoolId, false);
    expect(await updateOwnCustomer(c, edit(), MONTH)).toMatchObject({ ok: false, status: 409 });
    expect((await fresh(c)).fullName).toBe("Học Sinh Sửa");
  });
});
