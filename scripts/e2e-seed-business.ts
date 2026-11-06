import { readFileSync } from "node:fs";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../src/server/db/client";
import { bankPhotoSlots, banks, customerBanks, customers, proofPhotos, referralCodeSchools, referralCodes, schools, smsMessages, userManagedBanks, userPermissions, users, vouchers } from "../src/server/db/schema";
import { hashPassword } from "../src/server/auth/password";
import { newCustomerToken } from "../src/server/customers";
import { putImage } from "../src/server/storage";
import { plain } from "../src/lib/text";
import { E2E_PASSWORD } from "./e2e-clean";
import * as B from "./e2e-data-business";

type BankStatus = "selected" | "pending" | "passed" | "failed";
type Spec = {
  id: string;
  fullName: string;
  n: number;
  schoolId?: string;
  className?: string;
  parentName?: string;
  phone?: string;
  createdAt?: Date;
  banks?: { bank: 1 | 2; status: BankStatus; note?: string }[];
  voucher?: { code: string; issuedAt: Date };
  sms?: { status: "failed" | "sent"; at: Date; error?: string };
};

// Trạng thái hồ sơ suy từ các dòng ngân hàng như luồng thật: còn dòng chờ là Chờ kiểm tra, mọi dòng đã đánh dấu là Đã kiểm tra.
const customerStatus = (rows: { status: BankStatus }[]) =>
  !rows.length ? "new" : rows.some((r) => r.status === "pending") ? "pending_review" : rows.every((r) => r.status === "selected") ? "banks_selected" : "reviewed";

const minutes = (base: string, n: number) => new Date(new Date(base).getTime() + n * 60_000);

// Dữ liệu cho test ca biên của nhóm nghiệp vụ: dựng thẳng dòng DB, không đi qua web học sinh.
export async function seedBusiness(adminId: string) {
  await db.insert(schools).values([
    { id: B.B_SCHOOL_ID, name: B.B_SCHOOL, wardCode: "25585", contactName: "E2E Biên", contactPhone: "0903111333", createdBy: adminId },
    { id: B.B_SCHOOL2_ID, name: B.B_SCHOOL2, wardCode: "25585", contactName: "E2E Biên", contactPhone: "0903111444", createdBy: adminId },
  ]);
  const bankRows = [
    { id: B.B_BANK1_ID, code: "ZZE2EB1", name: B.B_BANK1, sortOrder: 95 },
    { id: B.B_BANK2_ID, code: "ZZE2EB2", name: B.B_BANK2, sortOrder: 96 },
    { id: B.B_BANK3_ID, code: "ZZE2EB3", name: B.B_BANK3, sortOrder: 97 },
  ];
  await db.insert(banks).values(bankRows.map((b) => ({ ...b, guide: ["Tải app.", "Mở tài khoản."] })));
  const slots = await db
    .insert(bankPhotoSlots)
    .values(bankRows.map((b) => ({ bankId: b.id, name: "Ảnh màn hình chính" })))
    .returning({ id: bankPhotoSlots.id, bankId: bankPhotoSlots.bankId });
  const codes = await db
    .insert(referralCodes)
    .values(bankRows.map((b, i) => ({ bankId: b.id, displayName: `ZZE2E Biên B${i + 1}`, code: `BIEN-B${i + 1}-01`, monthlyQuota: 100, createdBy: adminId })))
    .returning({ id: referralCodes.id, bankId: referralCodes.bankId, code: referralCodes.code });
  await db.insert(referralCodeSchools).values(codes.flatMap((c) => [B.B_SCHOOL_ID, B.B_SCHOOL2_ID].map((schoolId) => ({ referralCodeId: c.id, schoolId }))));

  const passwordHash = await hashPassword(E2E_PASSWORD);
  const staff = await db
    .insert(users)
    .values([
      { username: B.B_USER1, fullName: "E2E Biên Một", role: "staff", passwordHash },
      { username: B.B_USER2, fullName: "E2E Biên Hai", role: "staff", passwordHash },
      { username: B.B_USER3, fullName: "E2E Biên Ba", role: "staff", passwordHash },
    ])
    .returning({ id: users.id });
  await db.insert(userManagedBanks).values(staff.map((u, i) => ({ userId: u.id, bankId: bankRows[i].id })));
  await db.insert(userPermissions).values({ userId: staff[1].id, permission: "export_excel" });
  // Quản B2 và B3: test bỏ giao B2 giữa chừng, B3 giữ quyền vào trang hồ sơ nên API trả 404 thay vì 403.
  const [lost] = await db.insert(users).values({ username: B.B_USER4, fullName: "E2E Biên Bốn", role: "staff", passwordHash }).returning({ id: users.id });
  await db.insert(userManagedBanks).values([B.B_BANK2_ID, B.B_BANK3_ID].map((bankId) => ({ userId: lost.id, bankId })));

  const bankId = { 1: B.B_BANK1_ID, 2: B.B_BANK2_ID } as const;
  const specs: Spec[] = [
    ...Array.from({ length: B.B_PAGE_COUNT }, (_, i): Spec => {
      const n = i + 1;
      const createdAt = minutes("2026-10-20T01:00:00Z", n);
      const at = minutes("2026-10-20T03:00:00Z", n);
      return {
        id: B.bPageId(n),
        fullName: B.bPageName(n),
        n: 300 + n,
        createdAt,
        banks: n === B.B_PAGE_COUNT ? [{ bank: 1, status: "passed" }, { bank: 2, status: "pending" }] : [{ bank: 1, status: "passed" }],
        voucher: { code: B.bPageVoucher(n), issuedAt: at },
        sms: { status: "failed", at },
      };
    }),
    ...Array.from({ length: B.B_WAIT_COUNT }, (_, i): Spec => {
      const last = i === B.B_WAIT_COUNT - 1;
      return { id: B.bWaitId(i), fullName: B.bWaitName(i), n: 230 + i, createdAt: last ? new Date("2026-10-14T03:00:00Z") : minutes("2026-10-15T01:00:00Z", i), banks: [{ bank: i === 0 ? 2 : 1, status: "pending" }] };
    }),
    // 23:30 ngày 31/10 và 00:30 ngày 01/11 giờ Việt Nam: lệch ngày nếu so theo UTC.
    { id: B.B_IDS.late, fullName: B.B_LATE, n: 220, createdAt: new Date("2026-10-31T16:30:00Z"), banks: [{ bank: 2, status: "passed" }], voucher: { code: B.B_LATE_VOUCHER, issuedAt: new Date("2026-10-31T16:45:00Z") }, sms: { status: "sent", at: new Date("2026-10-31T16:50:00Z") } },
    { id: B.B_IDS.early, fullName: B.B_EARLY, n: 221, createdAt: new Date("2026-10-31T17:30:00Z"), banks: [{ bank: 2, status: "passed" }], voucher: { code: B.B_EARLY_VOUCHER, issuedAt: new Date("2026-10-31T17:45:00Z") } },
    { id: B.B_IDS.long, fullName: B.B_LONG_NAME, n: 201, className: B.B_LONG_CLASS, parentName: B.B_LONG_PARENT, banks: [{ bank: 1, status: "pending" }] },
    { id: B.B_IDS.unbroken, fullName: B.B_UNBROKEN_NAME, n: 202, parentName: B.B_UNBROKEN_PARENT, banks: [{ bank: 1, status: "pending", note: B.B_UNBROKEN_NOTE }] },
    { id: B.B_IDS.xss, fullName: B.B_XSS, n: 203, parentName: B.B_IMG, banks: [{ bank: 1, status: "pending", note: "<b>đậm</b>\nDòng hai 😀" }] },
    { id: B.B_IDS.quotes, fullName: B.B_QUOTES, n: 204, banks: [{ bank: 1, status: "selected" }] },
    { id: B.B_IDS.emoji, fullName: B.B_EMOJI, n: 205, banks: [{ bank: 1, status: "selected" }] },
    // Có voucher để file Mã voucher cũng có ô bắt đầu bằng = + - @.
    { id: B.B_IDS.formula, fullName: B.B_FORMULA, n: 206, className: B.B_FORMULA_CLASS, parentName: B.B_FORMULA_PARENT, banks: [{ bank: 1, status: "passed" }], voucher: { code: B.B_FORMULA_VOUCHER, issuedAt: new Date("2026-10-27T03:00:00Z") } },
    { id: B.B_IDS.minus, fullName: B.B_MINUS, n: 207, parentName: B.B_MINUS_PARENT, banks: [{ bank: 1, status: "passed" }], voucher: { code: B.B_MINUS_VOUCHER, issuedAt: new Date("2026-10-27T03:01:00Z") } },
    { id: B.B_IDS.only2, fullName: B.B_NAMES.only2, n: 208, banks: [{ bank: 2, status: "pending" }], sms: { status: "failed", at: new Date("2026-10-25T03:00:00Z") } },
    { id: B.B_IDS.both, fullName: B.B_NAMES.both, n: 209, banks: [{ bank: 1, status: "pending" }, { bank: 2, status: "pending" }] },
    { id: B.B_IDS.none, fullName: B.B_NAMES.none, n: 210 },
    { id: B.B_IDS.dup1, fullName: B.B_NAMES.dup1, n: 211, phone: B.bPhone(211), banks: [{ bank: 1, status: "selected" }] },
    { id: B.B_IDS.dup2, fullName: B.B_NAMES.dup2, n: 212, phone: B.bPhone(211), schoolId: B.B_SCHOOL2_ID, banks: [{ bank: 1, status: "selected" }] },
    { id: B.B_IDS.twoTabs, fullName: B.B_NAMES.twoTabs, n: 213, banks: [{ bank: 1, status: "pending" }] },
    { id: B.B_IDS.editTabs, fullName: B.B_NAMES.editTabs, n: 214, banks: [{ bank: 1, status: "pending" }] },
    { id: B.B_IDS.replace, fullName: B.B_NAMES.replace, n: 215, banks: [{ bank: 1, status: "pending" }] },
    { id: B.B_IDS.note, fullName: B.B_NAMES.note, n: 216, banks: [{ bank: 1, status: "pending" }] },
    { id: B.B_IDS.form, fullName: B.B_NAMES.form, n: 217, banks: [{ bank: 1, status: "pending" }] },
    { id: B.B_IDS.resend, fullName: B.B_NAMES.resend, n: 218, banks: [{ bank: 1, status: "passed" }], voucher: { code: "ZZBIEN-BGL-10A1-CCCC", issuedAt: new Date("2026-10-26T03:00:00Z") }, sms: { status: "failed", at: new Date("2026-10-26T03:00:00Z") } },
    { id: B.B_IDS.resendTabs, fullName: B.B_NAMES.resendTabs, n: 219, banks: [{ bank: 1, status: "passed" }], voucher: { code: "ZZBIEN-BGHT-10A1-DDDD", issuedAt: new Date("2026-10-26T04:00:00Z") }, sms: { status: "failed", at: new Date("2026-10-26T04:00:00Z") } },
    // Hồ sơ cho ca đồng thời mới: ngày tạo cũ hơn các hồ sơ không ghi ngày, không đẩy hồ sơ khác ra khỏi trang 1 khi tìm "bien".
    { id: B.B_IDS.oldPhoto, fullName: B.B_NAMES.oldPhoto, n: 222, createdAt: new Date("2026-10-22T03:00:00Z"), banks: [{ bank: 1, status: "pending" }] },
    { id: B.B_IDS.sameTime, fullName: B.B_NAMES.sameTime, n: 223, createdAt: new Date("2026-10-22T03:01:00Z"), banks: [{ bank: 1, status: "pending" }] },
    { id: B.B_IDS.failFirst, fullName: B.B_NAMES.failFirst, n: 224, createdAt: new Date("2026-10-22T03:02:00Z"), banks: [{ bank: 1, status: "pending" }] },
    { id: B.B_IDS.doubleClick, fullName: B.B_NAMES.doubleClick, n: 225, createdAt: new Date("2026-10-22T03:03:00Z"), banks: [{ bank: 1, status: "pending" }] },
    {
      id: B.B_IDS.longError,
      fullName: B.B_NAMES.longError,
      n: 226,
      createdAt: new Date("2026-10-22T03:04:00Z"),
      banks: [{ bank: 1, status: "passed" }],
      voucher: { code: "ZZBIEN-BLD-10A1-HHHH", issuedAt: new Date("2026-10-22T04:00:00Z") },
      sms: { status: "failed", at: new Date("2026-10-22T04:00:00Z"), error: B.B_LONG_SMS_ERROR },
    },
    { id: B.B_IDS.lostBank, fullName: B.B_NAMES.lostBank, n: 227, createdAt: new Date("2026-10-22T03:05:00Z"), banks: [{ bank: 2, status: "pending" }], sms: { status: "failed", at: new Date("2026-10-22T04:00:00Z") } },
    // n từ 250: 230 tới 246 đã là số của hồ sơ Chờ Kiểm.
    { id: B.B_IDS.selfReplace, fullName: B.B_NAMES.selfReplace, n: 250, createdAt: new Date("2026-10-22T03:06:00Z"), banks: [{ bank: 1, status: "pending" }] },
    { id: B.B_IDS.slotGone, fullName: B.B_NAMES.slotGone, n: 251, createdAt: new Date("2026-10-22T03:07:00Z"), banks: [{ bank: 2, status: "pending" }] },
    { id: B.B_IDS.replaceTabs, fullName: B.B_NAMES.replaceTabs, n: 252, createdAt: new Date("2026-10-22T03:08:00Z"), banks: [{ bank: 1, status: "pending" }] },
    { id: B.B_IDS.failThenPass, fullName: B.B_NAMES.failThenPass, n: 253, createdAt: new Date("2026-10-22T03:09:00Z"), banks: [{ bank: 1, status: "pending" }] },
  ];

  const [reviewer1, reviewer2] = staff;
  for (const s of specs) {
    const rows = s.banks ?? [];
    const passedAt = s.voucher?.issuedAt ?? null;
    await db.insert(customers).values({
      id: s.id,
      schoolId: s.schoolId ?? B.B_SCHOOL_ID,
      fullName: s.fullName,
      nameSearch: plain(s.fullName),
      className: s.className ?? "10A1",
      phone: s.phone ?? B.bPhone(s.n),
      parentName: s.parentName ?? "Phụ Huynh Biên",
      parentPhone: B.bParentPhone(s.n),
      status: customerStatus(rows),
      tokenHash: newCustomerToken().tokenHash,
      submittedAt: rows.some((r) => r.status !== "selected") ? (s.createdAt ?? new Date()) : null,
      firstPassedAt: passedAt,
      ...(s.createdAt ? { createdAt: s.createdAt } : {}),
    });
    for (const [i, r] of rows.entries()) {
      const code = codes.find((c) => c.bankId === bankId[r.bank])!;
      const reviewed = r.status === "passed" || r.status === "failed";
      await db.insert(customerBanks).values({
        customerId: s.id,
        bankId: bankId[r.bank],
        slot: i + 1,
        referralCodeId: code.id,
        referralCode: code.code!,
        yearMonth: "2026-10",
        status: r.status,
        submittedAt: r.status === "selected" ? null : (s.createdAt ?? new Date()),
        reviewedAt: reviewed ? (passedAt ?? new Date()) : null,
        reviewedBy: reviewed ? (r.bank === 1 ? reviewer1.id : reviewer2.id) : null,
        note: r.note ?? "",
      });
    }
    if (s.voucher) await db.insert(vouchers).values({ customerId: s.id, code: s.voucher.code, issuedAt: s.voucher.issuedAt });
    if (s.sms)
      await db.insert(smsMessages).values({
        customerId: s.id,
        kind: "voucher",
        toPhone: B.bParentPhone(s.n),
        body: "ZZE2E",
        status: s.sms.status,
        attempts: s.sms.status === "failed" ? 3 : 1,
        error: s.sms.status === "failed" ? (s.sms.error ?? "Nhà mạng từ chối số này") : "",
        sentAt: s.sms.status === "sent" ? s.sms.at : null,
        createdAt: s.sms.at,
      });
  }

  // Hồ sơ có hai ngân hàng cần ảnh thật ở cả hai dòng: Nhân viên quản một bên thì không mở được ảnh bên kia.
  const photo = new Uint8Array(readFileSync(join(import.meta.dir, "../public/brand/photo.jpg")));
  const both = await db.select({ id: customerBanks.id, bankId: customerBanks.bankId }).from(customerBanks).where(eq(customerBanks.customerId, B.B_IDS.both));
  for (const row of both) {
    const up = await putImage(photo, "proofs");
    if (!up.ok) throw new Error(up.message);
    await db.insert(proofPhotos).values({ customerBankId: row.id, slotId: slots.find((s) => s.bankId === row.bankId)!.id, s3Key: up.key, sizeBytes: up.size });
  }
}
