import { randomUUID } from "node:crypto";
import { TEST_NAME, makeActor } from "./helpers";
import { db } from "../../src/server/db/client";
import { bankPhotoSlots, customerBanks, customers, photoChecks } from "../../src/server/db/schema";
import { hashToken } from "../../src/server/auth/session";
import { createBank } from "../../src/server/banks";
import { createCode } from "../../src/server/referralCodes";
import { createSchool } from "../../src/server/schools";
import { BankForm } from "../../src/lib/bankForm";
import { CodeForm } from "../../src/lib/codeForm";
import { SchoolForm } from "../../src/lib/schoolForm";
import { plain } from "../../src/lib/text";
import type { SessionUser } from "../../src/lib/types";

export type Program = { manager: SessionUser; schoolId: string; schoolName: string; bank: Record<string, string>; code: Record<string, string>; slot: Record<string, string> };

// Trường có các ngân hàng mở, mỗi ngân hàng một mã và một khung ảnh bật kiểm họ tên.
export async function setupProgram(tag: string, keys: string[]): Promise<Program> {
  const manager = await makeActor(`${tag}_manager`, "manager");
  const schoolName = `${TEST_NAME}THPT ${tag}`;
  const s = await createSchool(manager, SchoolForm.parse({ name: schoolName, provinceCode: "80", wardCode: "25585", contactName: "A", contactPhone: "0903111222" }));
  if (!s.ok) throw new Error(s.message);
  const bank: Record<string, string> = {};
  const code: Record<string, string> = {};
  const slot: Record<string, string> = {};
  for (const [i, k] of keys.entries()) {
    const b = await createBank(manager, BankForm.parse({ code: `Z${tag.slice(0, 5).toUpperCase()}${k}`, name: `${TEST_NAME}${tag} ${k}`, sortOrder: String(i), managerIds: [] }));
    if (!b.ok) throw new Error(b.message);
    bank[k] = b.id;
    const c = await createCode(manager, CodeForm.parse({ bankId: b.id, displayName: `${TEST_NAME}${tag} ${k}`, code: `${tag.toUpperCase()}-${k}`, qrKey: null, openUrl: "", monthlyQuota: "1000", priority: "0", schoolIds: [s.id] }));
    if (!c.ok) throw new Error(c.message);
    code[k] = c.id;
    const [row] = await db.insert(bankPhotoSlots).values({ bankId: b.id, name: `Ảnh ${k}`, checkName: true }).returning({ id: bankPhotoSlots.id });
    slot[k] = row.id;
  }
  return { manager, schoolId: s.id, schoolName, bank, code, slot };
}

let phoneSeq = 0;
const nextPhone = (prefix: string) => `${prefix}${String((phoneSeq += 1) + Math.floor(Math.random() * 9_000_000)).padStart(7, "0").slice(-7)}`;

type BankSpec = { key: string; status: "selected" | "pending" | "passed" | "failed"; reviewedBy?: string };

// Dựng thẳng dòng DB cho test danh sách: đi qua luồng học sinh thì mỗi hồ sơ mất vài chục câu lệnh.
export async function insertCustomer(
  p: Program,
  values: { fullName: string; className?: string; phone?: string; parentPhone?: string; status: (typeof customers.$inferSelect)["status"]; submittedAt?: Date | null; createdAt?: Date; banks?: BankSpec[] },
): Promise<{ id: string; rows: Record<string, string> }> {
  const [row] = await db
    .insert(customers)
    .values({
      schoolId: p.schoolId,
      fullName: values.fullName,
      nameSearch: plain(values.fullName),
      className: values.className ?? "11A3",
      phone: values.phone ?? nextPhone("090"),
      parentPhone: values.parentPhone ?? nextPhone("098"),
      status: values.status,
      tokenHash: hashToken(randomUUID()),
      submittedAt: values.submittedAt ?? null,
      createdAt: values.createdAt ?? values.submittedAt ?? undefined,
    })
    .returning({ id: customers.id });
  const rows: Record<string, string> = {};
  for (const [i, b] of (values.banks ?? []).entries()) {
    const done = b.status === "passed" || b.status === "failed";
    const [cb] = await db
      .insert(customerBanks)
      .values({
        customerId: row.id,
        bankId: p.bank[b.key],
        slot: i + 1,
        referralCodeId: p.code[b.key],
        referralCode: `CODE-${b.key}`,
        yearMonth: "2026-11",
        status: b.status,
        submittedAt: values.submittedAt ?? null,
        reviewedAt: done ? new Date() : null,
        reviewedBy: done ? (b.reviewedBy ?? p.manager.id) : null,
      })
      .returning({ id: customerBanks.id });
    rows[b.key] = cb.id;
  }
  return { id: row.id, rows };
}

export async function addPhotoCheck(customerBankId: string, passed: number, total: number, createdAt = new Date()) {
  await db.insert(photoChecks).values({ customerBankId, status: "done", passed, total, createdAt, checkedAt: createdAt });
}
