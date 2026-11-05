import { afterAll, beforeAll, beforeEach, describe, expect, test } from "bun:test";
import { and, eq } from "drizzle-orm";
import { TEST_NAME, cleanTestUsers, fakeStore, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { bankPhotoSlots, customerBanks, customers } from "../../src/server/db/schema";
import { createBank } from "../../src/server/banks";
import { createSchool, setSchoolActive } from "../../src/server/schools";
import { createCode } from "../../src/server/referralCodes";
import { createCustomer, reserveBanks, studentState, submitForReview, type Customer } from "../../src/server/customers";
import { cancelBanks, photoUploadUrl, recordPhoto } from "../../src/server/customerPhotos";
import { BankForm } from "../../src/lib/bankForm";
import { CodeForm } from "../../src/lib/codeForm";
import { CustomerForm } from "../../src/lib/customerForm";
import { SchoolForm } from "../../src/lib/schoolForm";
import type { SessionUser } from "../../src/lib/types";

const MONTH = "2026-11";
let manager: SessionUser;
let schoolId: string;
let bankId: string;
let slotId: string;
let phoneSeq = 500;

async function student(): Promise<Customer> {
  phoneSeq += 1;
  const r = await createCustomer(
    CustomerForm.parse({ schoolId, fullName: "Học Sinh Đóng", className: "10A1", phone: `0900000${phoneSeq}`, parentName: "Phụ Huynh", parentPhone: `0910000${phoneSeq}`, existingBankIds: [] }),
    null,
    MONTH,
  );
  if (!r.ok) throw new Error(r.message);
  return (await db.select().from(customers).where(eq(customers.id, r.id)))[0];
}
const fresh = async (c: Customer) => (await db.select().from(customers).where(eq(customers.id, c.id)))[0];

beforeAll(async () => {
  await cleanTestUsers();
  manager = await makeActor("closed_manager", "manager");
  const s = await createSchool(manager, SchoolForm.parse({ name: TEST_NAME + "THPT Đóng", provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903111222" }));
  if (!s.ok) throw new Error(s.message);
  schoolId = s.id;
  const b = await createBank(manager, BankForm.parse({ code: "ZZCLOSE", name: TEST_NAME + "Đóng", sortOrder: "1", managerIds: [] }));
  if (!b.ok) throw new Error(b.message);
  bankId = b.id;
  const c = await createCode(manager, CodeForm.parse({ bankId, displayName: TEST_NAME + "Đóng", code: "CL-1", qrKey: null, openUrl: "", monthlyQuota: "100", priority: "0", schoolIds: [schoolId] }));
  if (!c.ok) throw new Error(c.message);
  [{ id: slotId }] = await db.insert(bankPhotoSlots).values({ bankId, name: "Ảnh", checkName: true }).returning({ id: bankPhotoSlots.id });
});
afterAll(cleanTestUsers);
beforeEach(async () => {
  await setSchoolActive(manager, schoolId, true);
});

describe("trường đã đóng", () => {
  test("học sinh chưa giữ chỗ thì không giữ chỗ được, web biết trường đã đóng", async () => {
    const c = await student();
    await setSchoolActive(manager, schoolId, false);
    expect(await reserveBanks(c, [bankId], MONTH)).toMatchObject({ ok: false, status: 409 });
    expect((await fresh(c)).status).toBe("new");
    expect(await db.select().from(customerBanks).where(eq(customerBanks.customerId, c.id))).toEqual([]);
    expect((await studentState(c, MONTH, fakeStore().store)).school.active).toBe(false);
  });

  test("học sinh đã giữ chỗ vẫn nộp ảnh và gửi kiểm tra được, nhưng không quay lại bỏ chỗ", async () => {
    const c = await student();
    expect(await reserveBanks(c, [bankId], MONTH)).toEqual({ ok: true });
    await setSchoolActive(manager, schoolId, false);
    const held = await fresh(c);
    const fake = fakeStore();
    const [cb] = await db.select().from(customerBanks).where(and(eq(customerBanks.customerId, c.id), eq(customerBanks.bankId, bankId)));
    expect(await cancelBanks(held, fake.store)).toMatchObject({ ok: false, status: 409 });
    const u = await photoUploadUrl(held, { customerBankId: cb.id, slotId, contentType: "image/webp", size: 1000 }, fake.store);
    if (!u.ok) throw new Error(u.message);
    fake.objects.set(u.key, 1000);
    expect(await recordPhoto(held, { customerBankId: cb.id, slotId, key: u.key }, fake.store)).toEqual({ ok: true });
    expect(await submitForReview(held)).toEqual({ ok: true });
    expect((await fresh(c)).status).toBe("pending_review");
  });
});
