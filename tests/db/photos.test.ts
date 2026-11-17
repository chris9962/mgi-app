import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { and, eq, isNull } from "drizzle-orm";
import { FAKE_WEBP, TEST_NAME, cleanTestUsers, fakeStore, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { bankPhotoSlots, customerBanks, customers, proofPhotos } from "../../src/server/db/schema";
import { createBank } from "../../src/server/banks";
import { createSchool } from "../../src/server/schools";
import { createCode } from "../../src/server/referralCodes";
import { createCustomer, reserveBanks, studentState, submitForReview, type Customer } from "../../src/server/customers";
import { cancelBanks, uploadPhoto } from "../../src/server/customerPhotos";
import { BankForm } from "../../src/lib/bankForm";
import { CodeForm } from "../../src/lib/codeForm";
import { CustomerForm } from "../../src/lib/customerForm";
import { SchoolForm } from "../../src/lib/schoolForm";
import { isImageKey } from "../../src/lib/imageKey";
import type { SessionUser } from "../../src/lib/types";

const MONTH = "2026-11";
let manager: SessionUser;
let schoolId: string;
let phoneSeq = 300;
const bank: Record<string, string> = {};
const slot: Record<string, string> = {};

async function student(): Promise<Customer> {
  phoneSeq += 1;
  const r = await createCustomer(
    CustomerForm.parse({ schoolId, fullName: "Học Sinh Ảnh", className: "10A1", parentPhone: `0910000${phoneSeq}`, consent: true, existingBankIds: [] }),
    null,
    MONTH,
  );
  if (!r.ok) throw new Error(r.message);
  const [row] = await db.select().from(customers).where(eq(customers.id, r.id));
  const res = await reserveBanks(row, [bank.A, bank.B], MONTH);
  if (!res.ok) throw new Error(res.message);
  return (await db.select().from(customers).where(eq(customers.id, r.id)))[0];
}

const rowOf = async (c: Customer, bankKey: string) => (await db.select().from(customerBanks).where(and(eq(customerBanks.customerId, c.id), eq(customerBanks.bankId, bank[bankKey]))))[0];

async function upload(c: Customer, bankKey: string, slotKey: string, fake: ReturnType<typeof fakeStore>, bytes = FAKE_WEBP) {
  const cb = await rowOf(c, bankKey);
  const result = await uploadPhoto(c, { customerBankId: cb.id, slotId: slot[slotKey] }, bytes, fake.store);
  const [row] = await db.select().from(proofPhotos).where(and(eq(proofPhotos.customerBankId, cb.id), eq(proofPhotos.slotId, slot[slotKey]), isNull(proofPhotos.replacedAt)));
  return { cb, stored: row?.s3Key, result };
}

const activeRows = (customerBankId: string) => db.select().from(proofPhotos).where(and(eq(proofPhotos.customerBankId, customerBankId), isNull(proofPhotos.replacedAt)));

beforeAll(async () => {
  await cleanTestUsers();
  manager = await makeActor("photo_manager", "manager");
  const s = await createSchool(manager, SchoolForm.parse({ name: TEST_NAME + "THPT Ảnh", provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903111222" }));
  if (!s.ok) throw new Error(s.message);
  schoolId = s.id;
  for (const [i, k] of ["A", "B"].entries()) {
    const b = await createBank(manager, BankForm.parse({ code: "ZZPH" + k, name: TEST_NAME + "Ảnh " + k, sortOrder: String(i), managerIds: [] }));
    if (!b.ok) throw new Error(b.message);
    bank[k] = b.id;
    const c = await createCode(manager, CodeForm.parse({ bankId: b.id, displayName: TEST_NAME + "Ảnh " + k, code: "PH-" + k, qrKey: null, openUrl: "", monthlyQuota: "100", priority: "0", schoolIds: [schoolId] }));
    if (!c.ok) throw new Error(c.message);
  }
  const rows = await db
    .insert(bankPhotoSlots)
    .values([
      { bankId: bank.A, name: "Ảnh màn hình chính", sortOrder: 0, checkName: true },
      { bankId: bank.A, name: "Ảnh chuyển khoản", sortOrder: 1 },
      { bankId: bank.A, name: "Khung đã bỏ", sortOrder: 2, removedAt: new Date() },
      { bankId: bank.B, name: "Ảnh B", sortOrder: 0 },
    ])
    .returning({ id: bankPhotoSlots.id });
  [slot.A1, slot.A2, slot.Agone, slot.B1] = rows.map((r) => r.id);
});
afterAll(cleanTestUsers);

describe("nộp ảnh", () => {
  test("ảnh nộp xong ghi một dòng với khoá và dung lượng của object đã ghi lên S3", async () => {
    const c = await student();
    const fake = fakeStore();
    const { cb, result } = await upload(c, "A", "A1", fake, new Uint8Array([...FAKE_WEBP, ...new Array(500).fill(1)]));
    expect(result).toEqual({ ok: true });
    const rows = await db.select().from(proofPhotos).where(eq(proofPhotos.customerBankId, cb.id));
    expect(rows.map((r) => [r.slotId, r.sizeBytes, r.uploadedBy])).toEqual([[slot.A1, 1500, null]]);
    expect(isImageKey(rows[0].s3Key, "proofs")).toBe(true);
    expect([...fake.objects.keys()]).toEqual([rows[0].s3Key]);
  });

  test("khung của ngân hàng khác, khung đã bỏ, dòng của học sinh khác bị từ chối trước khi ghi S3", async () => {
    const [c, other] = [await student(), await student()];
    const fake = fakeStore();
    const cbA = (await rowOf(c, "A")).id;
    for (const [who, slotId] of [
      [c, slot.B1],
      [c, slot.Agone],
      [other, slot.A1],
    ] as const) {
      expect(await uploadPhoto(who, { customerBankId: cbA, slotId }, FAKE_WEBP, fake.store)).toMatchObject({ ok: false, status: 404 });
    }
    expect(fake.puts()).toBe(0);
    expect(await activeRows(cbA)).toEqual([]);
  });

  test("hồ sơ đã gửi kiểm tra bị từ chối trước khi ghi S3", async () => {
    const c = await student();
    const fake = fakeStore();
    await upload(c, "A", "A1", fake);
    await upload(c, "A", "A2", fake);
    await upload(c, "B", "B1", fake);
    expect(await submitForReview(c)).toEqual({ ok: true });
    const [locked] = await db.select().from(customers).where(eq(customers.id, c.id));
    const before = fake.puts();
    expect(await uploadPhoto(locked, { customerBankId: (await rowOf(c, "A")).id, slotId: slot.A1 }, FAKE_WEBP, fake.store)).toMatchObject({ ok: false, status: 409 });
    expect(await uploadPhoto(c, { customerBankId: (await rowOf(c, "A")).id, slotId: slot.A1 }, FAKE_WEBP, fake.store)).toMatchObject({ ok: false, status: 409 });
    expect(fake.puts()).toBe(before);
  });

  test("file không phải ảnh bị từ chối, không ghi dòng", async () => {
    const c = await student();
    const fake = fakeStore();
    const { cb, result } = await upload(c, "A", "A1", fake, new TextEncoder().encode("<html>"));
    expect(result).toMatchObject({ ok: false, status: 400, field: "file" });
    expect(await activeRows(cb.id)).toEqual([]);
    expect(fake.objects.size).toBe(0);
  });

  test("hồ sơ bị gửi kiểm tra trong lúc ảnh đang ghi S3 thì từ chối và xoá object vừa ghi", async () => {
    const c = await student();
    const fake = fakeStore();
    await upload(c, "A", "A2", fake);
    await upload(c, "B", "B1", fake);
    await upload(c, "A", "A1", fake);
    const kept = new Set(fake.objects.keys());
    const store = {
      ...fake.store,
      put: async (bytes: Uint8Array) => {
        const r = await fake.store.put(bytes);
        expect(await submitForReview(c)).toEqual({ ok: true });
        return r;
      },
    };
    const cb = await rowOf(c, "A");
    expect(await uploadPhoto(c, { customerBankId: cb.id, slotId: slot.A1 }, FAKE_WEBP, store)).toMatchObject({ ok: false, status: 409 });
    expect(new Set(fake.objects.keys())).toEqual(kept);
  });

  test("ghi DB lỗi sau khi đã ghi S3 thì xoá object vừa ghi", async () => {
    const c = await student();
    const fake = fakeStore();
    const cb = await rowOf(c, "A");
    // Dung lượng vượt kiểu integer của cột size_bytes: câu insert lỗi thật ở Postgres.
    const store = { ...fake.store, put: async (bytes: Uint8Array) => ({ ...(await fake.store.put(bytes)), size: 2 ** 31 }) as { ok: true; key: string; size: number } };
    await expect(uploadPhoto(c, { customerBankId: cb.id, slotId: slot.A1 }, FAKE_WEBP, store)).rejects.toThrow();
    expect(fake.puts()).toBe(1);
    expect(fake.objects.size).toBe(0);
    expect(await activeRows(cb.id)).toEqual([]);
  });

  test("chụp lại khung đó thì xoá dòng cũ và object cũ sau khi commit, giữ một ảnh cho khung", async () => {
    const c = await student();
    const fake = fakeStore();
    const first = await upload(c, "A", "A1", fake);
    const second = await upload(c, "A", "A1", fake, new Uint8Array([...FAKE_WEBP, 1, 2, 3]));
    expect(second.result.ok).toBe(true);
    const rows = await db.select().from(proofPhotos).where(eq(proofPhotos.customerBankId, first.cb.id));
    expect(rows.map((r) => [r.s3Key, r.sizeBytes])).toEqual([[second.stored, 1003]]);
    expect(fake.removed).toEqual([first.stored!]);
    expect([...fake.objects.keys()]).toEqual([second.stored]);
  });

  test("hai lần gửi cùng khung chạy song song thật: còn đúng một dòng, object của dòng đó còn, object kia bị xoá", async () => {
    const c = await student();
    const fake = fakeStore();
    const cb = await rowOf(c, "A");
    // Hai request cùng ghi xong S3 rồi mới vào transaction, nên cả hai cùng tranh khoá dòng hồ sơ.
    let arrived = 0;
    let open = () => {};
    const both = new Promise<void>((resolve) => (open = resolve));
    const store = {
      ...fake.store,
      put: async (bytes: Uint8Array) => {
        const r = await fake.store.put(bytes);
        if (++arrived === 2) open();
        await both;
        return r;
      },
    };
    const results = await Promise.all([1, 2].map((n) => uploadPhoto(c, { customerBankId: cb.id, slotId: slot.A1 }, new Uint8Array([...FAKE_WEBP, n]), store)));
    expect(results).toEqual([{ ok: true }, { ok: true }]);
    const rows = await activeRows(cb.id);
    expect(rows.length).toBe(1);
    expect([...fake.objects.keys()]).toEqual([rows[0].s3Key]);
    expect(fake.removed.length).toBe(1);
  });

  test("hồ sơ hiện các khung chưa bỏ theo thứ tự, khung đã có ảnh kèm link xem", async () => {
    const c = await student();
    const fake = fakeStore();
    const { stored } = await upload(c, "A", "A2", fake, new Uint8Array([...FAKE_WEBP, ...new Array(240_000).fill(1)]));
    const state = await studentState(c, MONTH, fake.store);
    expect(state.banks.map((b) => [b.slot, b.bankId, b.referralCode])).toEqual([
      [1, bank.A, "PH-A"],
      [2, bank.B, "PH-B"],
    ]);
    expect(state.banks[0].slots.map((s) => [s.id, s.photo?.sizeBytes ?? null])).toEqual([
      [slot.A1, null],
      [slot.A2, 241_000],
    ]);
    expect(state.banks[0].slots[1].photo?.url).toContain(stored!);
  });
});

describe("Quay lại chọn ngân hàng", () => {
  test("xoá dòng đã chọn và ảnh, xoá object trên S3, học sinh về new, trả lượt cho mã", async () => {
    const c = await student();
    const fake = fakeStore();
    const a = await upload(c, "A", "A1", fake);
    const b = await upload(c, "B", "B1", fake);
    expect(await cancelBanks(c, fake.store)).toEqual({ ok: true });
    expect(await db.select().from(customerBanks).where(eq(customerBanks.customerId, c.id))).toEqual([]);
    expect(await db.select().from(proofPhotos).where(isNull(proofPhotos.replacedAt)).then((rows) => rows.filter((r) => [a.stored, b.stored].includes(r.s3Key)))).toEqual([]);
    expect(fake.removed).toEqual(expect.arrayContaining([a.stored!, b.stored!]));
    expect(fake.objects.size).toBe(0);
    const [row] = await db.select().from(customers).where(eq(customers.id, c.id));
    expect(row.status).toBe("new");
    expect((await studentState(row, MONTH, fake.store)).eligibleBanks.map((x) => x.id)).toEqual([bank.A, bank.B]);
    expect((await reserveBanks(row, [bank.B, bank.A], MONTH)).ok).toBe(true);
  });

  test("hồ sơ chưa chọn ngân hàng thì không quay lại được", async () => {
    const c = await student();
    await cancelBanks(c, fakeStore().store);
    const [row] = await db.select().from(customers).where(eq(customers.id, c.id));
    expect(await cancelBanks(row, fakeStore().store)).toMatchObject({ ok: false, status: 409 });
  });
});
