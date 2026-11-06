import { readFileSync } from "node:fs";
import { join } from "node:path";
import { and, eq, inArray, like, or, type SQL } from "drizzle-orm";
import { db, pool } from "../src/server/db/client";
import * as s from "../src/server/db/schema";
import { deleteImage, putImage } from "../src/server/storage";
import { currentYearMonth } from "../src/lib/month";
import { BANK, CODE, GUIDE_LONG, HSB, LONG_CODE, LONG_OPEN_URL, NAME, SCHOOL, SLOT } from "./e2e-data-student";

// Chỉ đụng dòng mang tiền tố ZZE2E HSB: DB local có dữ liệu thật của chủ dự án.
async function hsbSchools(): Promise<string[]> {
  return (await db.select({ id: s.schools.id }).from(s.schools).where(like(s.schools.name, `${HSB}%`))).map((r) => r.id);
}

async function customersOf(schoolIds: string[]): Promise<string[]> {
  if (!schoolIds.length) return [];
  return (await db.select({ id: s.customers.id }).from(s.customers).where(inArray(s.customers.schoolId, schoolIds))).map((r) => r.id);
}

async function removeCustomers(customers: string[], codes: string[] = []): Promise<string[]> {
  const conds = [customers.length ? inArray(s.customerBanks.customerId, customers) : null, codes.length ? inArray(s.customerBanks.referralCodeId, codes) : null].filter((c): c is SQL => c !== null);
  const rows = conds.length ? (await db.select({ id: s.customerBanks.id }).from(s.customerBanks).where(or(...conds))).map((r) => r.id) : [];
  const keys = rows.length ? (await db.select({ key: s.proofPhotos.s3Key }).from(s.proofPhotos).where(inArray(s.proofPhotos.customerBankId, rows))).map((r) => r.key) : [];
  if (customers.length) {
    await db.delete(s.customerExistingBanks).where(inArray(s.customerExistingBanks.customerId, customers));
    await db.delete(s.smsMessages).where(inArray(s.smsMessages.customerId, customers));
    await db.delete(s.vouchers).where(inArray(s.vouchers.customerId, customers));
  }
  if (rows.length) {
    await db.delete(s.reviewEvents).where(inArray(s.reviewEvents.customerBankId, rows));
    await db.delete(s.customerBanks).where(inArray(s.customerBanks.id, rows));
  }
  if (customers.length) await db.delete(s.customers).where(inArray(s.customers.id, customers));
  return keys;
}

export async function cleanStudentEdge() {
  const schools = await hsbSchools();
  const banks = (await db.select({ id: s.banks.id }).from(s.banks).where(like(s.banks.name, `${HSB}%`))).map((r) => r.id);
  const codeConds = [like(s.referralCodes.displayName, `${HSB}%`), banks.length ? inArray(s.referralCodes.bankId, banks) : null].filter((c): c is SQL => c !== null);
  const codes = (await db.select({ id: s.referralCodes.id }).from(s.referralCodes).where(or(...codeConds))).map((r) => r.id);
  const samples = banks.length ? (await db.select({ key: s.bankPhotoSlots.sampleKey }).from(s.bankPhotoSlots).where(inArray(s.bankPhotoSlots.bankId, banks))).flatMap((r) => (r.key ? [r.key] : [])) : [];
  const keys = await removeCustomers(await customersOf(schools), codes);
  if (banks.length) await db.delete(s.customerExistingBanks).where(inArray(s.customerExistingBanks.bankId, banks));
  if (codes.length) {
    await db.delete(s.referralCodeSchools).where(inArray(s.referralCodeSchools.referralCodeId, codes));
    await db.delete(s.referralCodeMonths).where(inArray(s.referralCodeMonths.referralCodeId, codes));
    await db.delete(s.referralCodes).where(inArray(s.referralCodes.id, codes));
  }
  if (schools.length) await db.delete(s.referralCodeSchools).where(inArray(s.referralCodeSchools.schoolId, schools));
  if (banks.length) {
    await db.delete(s.userManagedBanks).where(inArray(s.userManagedBanks.bankId, banks));
    await db.delete(s.bankPhotoSlots).where(inArray(s.bankPhotoSlots.bankId, banks));
    await db.delete(s.banks).where(inArray(s.banks.id, banks));
  }
  if (schools.length) await db.delete(s.schools).where(inArray(s.schools.id, schools));
  for (const key of [...keys, ...samples]) await deleteImage(key).catch((e) => console.error("Không xoá được ảnh e2e trên S3:", key, e instanceof Error ? e.message : e));
}

export async function seedStudentEdge() {
  await cleanStudentEdge();
  const sample = await putImage(new Uint8Array(readFileSync(join(import.meta.dir, "../public/brand/photo.jpg"))), "samples");
  if (!sample.ok) throw new Error(sample.message);
  const school = (id: string, name: string, active = true) => ({ id, name, active, wardCode: "25585", contactName: "E2E", contactPhone: "0903111222" });
  await db.insert(s.schools).values([
    school(SCHOOL.long, NAME.schoolLong),
    school(SCHOOL.closed, NAME.schoolClosed, false),
    school(SCHOOL.empty, NAME.schoolEmpty),
    school(SCHOOL.quota, NAME.schoolQuota),
    school(SCHOOL.photo, NAME.schoolPhoto),
    school(SCHOOL.noGuide, NAME.schoolNoGuide),
    school(SCHOOL.closing, NAME.schoolClosing),
    school(SCHOOL.stale, NAME.schoolStale),
    school(SCHOOL.mixed, NAME.schoolMixed),
  ]);
  const plainGuide = ["Tải app.", "Mở tài khoản.", "Nhập mã giới thiệu."];
  const banks = [
    { id: BANK.longSpace, name: NAME.bankLongSpace, guide: GUIDE_LONG },
    { id: BANK.longWord, name: NAME.bankLongWord, guide: plainGuide },
    { id: BANK.q1, name: NAME.q1, guide: plainGuide },
    { id: BANK.q2, name: NAME.q2, guide: plainGuide },
    { id: BANK.p1, name: NAME.p1, guide: plainGuide },
    { id: BANK.p2, name: NAME.p2, guide: [] },
    { id: BANK.p3, name: NAME.p3, guide: plainGuide },
    { id: BANK.p4, name: NAME.p4, guide: plainGuide },
    { id: BANK.stale, name: NAME.stale, guide: plainGuide },
  ];
  await db.insert(s.banks).values(banks.map((b, i) => ({ ...b, code: `ZZE2EHB${i + 1}`, sortOrder: 80 + i })));
  const slot = (id: string, bankId: string, name: string, sortOrder: number, withSample: boolean) => ({ id, bankId, name, sortOrder, sampleKey: withSample ? sample.key : null });
  await db.insert(s.bankPhotoSlots).values([
    slot(SLOT.longSpace1, BANK.longSpace, NAME.slotLongSpace, 0, true),
    slot(SLOT.longSpace2, BANK.longSpace, NAME.slotLongWord, 1, false),
    slot(SLOT.longWord, BANK.longWord, "Ảnh màn hình chính", 0, true),
    slot(SLOT.q1, BANK.q1, "Ảnh màn hình chính", 0, false),
    slot(SLOT.q2, BANK.q2, "Ảnh màn hình chính", 0, false),
    slot(SLOT.p1Main, BANK.p1, "Ảnh màn hình chính", 0, true),
    slot(SLOT.p1Transfer, BANK.p1, "Ảnh chuyển khoản", 1, false),
    slot(SLOT.p3, BANK.p3, "Ảnh màn hình chính", 0, true),
    slot(SLOT.p4, BANK.p4, "Ảnh màn hình chính", 0, false),
    slot(SLOT.stale1, BANK.stale, "Ảnh 1", 0, false),
    slot(SLOT.stale2, BANK.stale, "Ảnh 2", 1, false),
  ]);
  const codes = [
    { id: CODE.longSpace, bankId: BANK.longSpace, code: LONG_CODE, openUrl: LONG_OPEN_URL, schools: [SCHOOL.long, SCHOOL.mixed] },
    { id: CODE.longWord, bankId: BANK.longWord, code: "HSB-WORD-01", openUrl: null, schools: [SCHOOL.long] },
    { id: CODE.q1, bankId: BANK.q1, code: "HSB-Q1-01", openUrl: null, schools: [SCHOOL.quota], quota: 1 },
    { id: CODE.q2, bankId: BANK.q2, code: "HSB-Q2-01", openUrl: null, schools: [SCHOOL.quota] },
    { id: CODE.p1, bankId: BANK.p1, code: "HSB-P1-01", openUrl: null, schools: [SCHOOL.photo, SCHOOL.closing] },
    { id: CODE.p2, bankId: BANK.p2, code: "HSB-P2-01", openUrl: null, schools: [SCHOOL.noGuide] },
    { id: CODE.p3, bankId: BANK.p3, code: "HSB-P3-01", openUrl: null, schools: [SCHOOL.photo, SCHOOL.noGuide, SCHOOL.closing, SCHOOL.stale, SCHOOL.mixed] },
    { id: CODE.p4, bankId: BANK.p4, code: "HSB-P4-01", openUrl: null, schools: [SCHOOL.photo] },
    { id: CODE.stale, bankId: BANK.stale, code: "HSB-STALE-01", openUrl: null, schools: [SCHOOL.stale] },
  ];
  await db.insert(s.referralCodes).values(codes.map((c) => ({ id: c.id, bankId: c.bankId, displayName: `${HSB}${c.code}`, code: c.code, openUrl: c.openUrl, monthlyQuota: c.quota ?? 1000 })));
  await db.insert(s.referralCodeSchools).values(codes.flatMap((c) => c.schools.map((schoolId) => ({ referralCodeId: c.id, schoolId }))));
}

// Học sinh của trường HSB mới được đổi: lệnh nhận id từ test, không được chạm hồ sơ thật.
async function hsbCustomer(id: string) {
  const [row] = await db
    .select({ id: s.customers.id })
    .from(s.customers)
    .innerJoin(s.schools, eq(s.schools.id, s.customers.schoolId))
    .where(and(eq(s.customers.id, id), like(s.schools.name, `${HSB}%`)));
  if (!row) throw new Error(`Không phải hồ sơ của trường ${HSB.trim()}: ${id}`);
  return row.id;
}

async function hsbSchool(id: string) {
  if (!(await hsbSchools()).includes(id)) throw new Error(`Không phải trường ${HSB.trim()}: ${id}`);
  return id;
}

const isHsbBank = (id: string) => (Object.values(BANK) as string[]).includes(id);

const ops: Record<string, (...args: string[]) => Promise<unknown>> = {
  seed: seedStudentEdge,
  clean: cleanStudentEdge,
  reset: async (schoolId) => {
    const keys = await removeCustomers(await customersOf([await hsbSchool(schoolId)]));
    for (const key of keys) await deleteImage(key).catch(() => undefined);
    await db.update(s.referralCodes).set({ monthlyQuota: 1 }).where(eq(s.referralCodes.id, CODE.q1));
    await db.update(s.referralCodes).set({ monthlyQuota: 1000 }).where(eq(s.referralCodes.id, CODE.q2));
    await db.delete(s.referralCodeMonths).where(inArray(s.referralCodeMonths.referralCodeId, Object.values(CODE)));
  },
  school: async (schoolId, state) => db.update(s.schools).set({ active: state === "open" }).where(eq(s.schools.id, await hsbSchool(schoolId))),
  "slot-add": async (bankId, slotId, name) => {
    if (!isHsbBank(bankId)) throw new Error(`Không phải ngân hàng HSB: ${bankId}`);
    await db.insert(s.bankPhotoSlots).values({ id: slotId, bankId, name, sortOrder: 9 }).onConflictDoUpdate({ target: s.bankPhotoSlots.id, set: { name, removedAt: null } });
  },
  // Khung của ngân hàng Đổi khung về như lúc seed: test thêm hay bỏ khung chạy thứ tự nào cũng được. Khung đã thêm có ảnh nên đánh dấu bỏ, không xoá.
  "slot-reset": async () => {
    await db.update(s.bankPhotoSlots).set({ removedAt: null }).where(inArray(s.bankPhotoSlots.id, [SLOT.stale1, SLOT.stale2]));
    await db.update(s.bankPhotoSlots).set({ removedAt: new Date() }).where(eq(s.bankPhotoSlots.id, SLOT.staleAdded));
  },
  "slot-remove": async (slotId) => {
    if (!(Object.values(SLOT) as string[]).includes(slotId)) throw new Error(`Không phải khung HSB: ${slotId}`);
    await db.update(s.bankPhotoSlots).set({ removedAt: new Date() }).where(eq(s.bankPhotoSlots.id, slotId));
  },
  quota: async (codeId, n) => {
    if (!(Object.values(CODE) as string[]).includes(codeId)) throw new Error(`Không phải mã HSB: ${codeId}`);
    await db.update(s.referralCodes).set({ monthlyQuota: Number(n) }).where(eq(s.referralCodes.id, codeId));
    await db.update(s.referralCodeMonths).set({ quota: Number(n) }).where(and(eq(s.referralCodeMonths.referralCodeId, codeId), eq(s.referralCodeMonths.yearMonth, currentYearMonth())));
  },
  submitted: async (customerId, at) => db.update(s.customers).set({ submittedAt: new Date(at) }).where(eq(s.customers.id, await hsbCustomer(customerId))),
  voucher: async (customerId) => db.insert(s.vouchers).values({ code: `ZZE2E-HSB-${customerId.slice(0, 8)}`, customerId: await hsbCustomer(customerId) }),
  // Kết quả hậu kiểm theo thứ tự vị trí ngân hàng, ví dụ "passed,failed".
  review: async (customerId, results) => {
    const id = await hsbCustomer(customerId);
    const rows = await db.select({ id: s.customerBanks.id }).from(s.customerBanks).where(eq(s.customerBanks.customerId, id)).orderBy(s.customerBanks.slot);
    const now = new Date();
    for (const [i, result] of results.split(",").entries()) {
      await db.update(s.customerBanks).set({ status: result as "passed" | "failed", reviewedAt: now }).where(eq(s.customerBanks.id, rows[i].id));
    }
    await db.update(s.customers).set({ status: "reviewed" }).where(eq(s.customers.id, id));
  },
};

if (import.meta.main) {
  const [op, ...args] = process.argv.slice(2);
  const run = ops[op];
  if (!run) {
    console.error(`Lệnh không có: ${op}. Có: ${Object.keys(ops).join(", ")}`);
    process.exit(1);
  }
  run(...args)
    .then(() => pool.end())
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
