import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import ExcelJS from "exceljs";
import { and, eq } from "drizzle-orm";
import { cleanTestUsers, makeActor } from "./helpers";
import { insertCustomer, setupProgram, type Program } from "./fixtures";
import { db } from "../../src/server/db/client";
import { auditLog, vouchers } from "../../src/server/db/schema";
import { exportCustomers, exportSchools, exportVouchers } from "../../src/server/exports";
import { parseCustomerFilters } from "../../src/lib/customerFilters";
import { parseVoucherFilters } from "../../src/lib/voucherFilters";
import type { SessionUser } from "../../src/lib/types";

let p: Program;
let exporterA: SessionUser;
let viewerA: SessionUser;
let voucherExporter: SessionUser;

async function sheet(bytes: Uint8Array) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(bytes as unknown as ArrayBuffer);
  return wb.worksheets[0];
}
// Dòng dữ liệu bắt đầu từ dòng 4, sau 3 tầng đầu bảng.
const column = (ws: ExcelJS.Worksheet, header: string) => {
  const idx = (ws.getRow(3).values as unknown[]).indexOf(header);
  return Array.from({ length: ws.rowCount - 3 }, (_, i) => ws.getRow(i + 4).getCell(idx).value);
};
const audits = (userId: string) => db.select().from(auditLog).where(and(eq(auditLog.userId, userId), eq(auditLog.action, "export_excel")));

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("export", ["A", "B"]);
  exporterA = await makeActor("export_staff_a", "staff", ["export_excel"], [p.bank.A]);
  viewerA = await makeActor("export_viewer_a", "staff", [], [p.bank.A]);
  voucherExporter = await makeActor("export_voucher", "staff", ["export_excel", "vouchers"]);
  const anh = await insertCustomer(p, { fullName: "Xuatds Trần Minh Anh", phone: "0912345678", parentPhone: "0987654321", status: "reviewed", submittedAt: new Date("2026-11-03T02:48:00Z"), banks: [{ key: "A", status: "passed" }, { key: "B", status: "failed" }] });
  await db.insert(vouchers).values({ customerId: anh.id, code: "ZZXUAT-TMA-11A3-K7Q2", issuedAt: new Date("2026-11-04T07:05:00Z") });
  await insertCustomer(p, { fullName: "Xuatds Lê Hoàng Nam", status: "pending_review", submittedAt: new Date(), banks: [{ key: "B", status: "pending" }] });
  await insertCustomer(p, { fullName: "Xuatds Phạm Thu Hà", status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "pending" }] });
});
afterAll(cleanTestUsers);

describe("xuất Excel hồ sơ", () => {
  test("đúng phạm vi và bộ lọc của người xuất, ghi audit", async () => {
    const r = await exportCustomers(exporterA, parseCustomerFilters({ q: "xuatds" }), "10.0.0.2");
    if (!r.ok) throw new Error(r.message);
    expect(r.fileName).toMatch(/^ho-so-hoc-sinh-\d{4}-\d{2}-\d{2}\.xlsx$/);
    const ws = await sheet(r.bytes);
    expect(column(ws, "HỌ TÊN")).toEqual(["XUATDS PHAM THU HA", "XUATDS TRAN MINH ANH"]);
    expect(column(ws, "SĐT PHỤ HUYNH")[1]).toBe("0987654321");
    expect(column(ws, "MÃ VOUCHER")).toEqual(["", "ZZXUAT-TMA-11A3-K7Q2"]);
    expect(ws.getRow(1).getCell(1).value).toBe("HỌC SINH");
    expect(ws.getRow(2).getCell(1).value).toBe(2);
    const [a] = await audits(exporterA.id);
    expect([a.targetType, (a.detail as { rows: number }).rows]).toEqual(["customers", 2]);

    const filtered = await exportCustomers(exporterA, parseCustomerFilters({ q: "xuatds", status: "reviewed" }), null);
    expect(filtered.ok && column(await sheet(filtered.bytes), "HỌ TÊN")).toEqual(["XUATDS TRAN MINH ANH"]);
  });

  test("thiếu quyền Xuất Excel thì 403, không ghi audit", async () => {
    expect(await exportCustomers(viewerA, parseCustomerFilters({}), null)).toMatchObject({ ok: false, status: 403 });
    expect((await audits(viewerA.id)).length).toBe(0);
  });
});

describe("xuất Excel trường và voucher", () => {
  test("trường theo ô tìm, có số hồ sơ và số đạt", async () => {
    const r = await exportSchools(p.manager, "thpt export", null);
    if (!r.ok) throw new Error(r.message);
    const ws = await sheet(r.bytes);
    expect(column(ws, "TRƯỜNG")).toEqual([p.schoolName]);
    expect(column(ws, "HỒ SƠ")).toEqual([3]);
    expect((await audits(p.manager.id)).some((a) => a.targetType === "schools")).toBe(true);
    expect(await exportSchools(exporterA, "", null)).toMatchObject({ ok: false, status: 403 });
  });

  test("voucher cần quyền Quản lý voucher và Xuất Excel", async () => {
    const r = await exportVouchers(voucherExporter, parseVoucherFilters({ q: "zzxuat" }), null);
    if (!r.ok) throw new Error(r.message);
    expect(column(await sheet(r.bytes), "MÃ VOUCHER")).toEqual(["ZZXUAT-TMA-11A3-K7Q2"]);
    expect(await exportVouchers(exporterA, parseVoucherFilters({}), null)).toMatchObject({ ok: false, status: 403 });
  });
});
