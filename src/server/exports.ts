import { count, desc, eq, inArray } from "drizzle-orm";
import { db } from "./db/client";
import { customers, schools, vouchers } from "./db/schema";
import { writeAudit } from "./audit";
import { banksOf, customerOrder, customerWhere } from "./customerList";
import { allSchools } from "./schools";
import { voucherBase, voucherWhere } from "./vouchers";
import { buildExcel, EXCEL_GROUP_COLORS, type ExcelColumn } from "@/lib/excel";
import { CUSTOMER_STATUS_LABEL, type CustomerFilters } from "@/lib/customerFilters";
import { formatDateTime } from "@/lib/dates";
import { studentLink } from "@/lib/links";
import { can } from "@/lib/permissions";
import type { CustomerBankStatus } from "@/lib/studentState";
import type { SessionUser } from "@/lib/types";
import type { VoucherFilters } from "@/lib/voucherFilters";

// Trần số dòng một file: dựng ExcelJS trong bộ nhớ máy chủ, danh sách dài hơn thì lọc bớt.
export const EXPORT_LIMIT = 20_000;

type Fail = { ok: false; message: string; status: 400 | 403 };
export type ExportResult = { ok: true; bytes: Uint8Array; fileName: string } | Fail;

const DENIED: Fail = { ok: false, message: "Không có quyền xuất Excel.", status: 403 };
const tooMany = (n: number): Fail => ({ ok: false, message: `Danh sách có ${n} dòng, quá ${EXPORT_LIMIT} dòng một file. Lọc bớt rồi xuất lại.`, status: 400 });
const today = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const BANK_RESULT: Record<CustomerBankStatus, string> = { selected: "Đang tạo", pending: "Chờ kiểm tra", passed: "Đạt", failed: "Không đạt" };

const STUDENT = { group: "HỌC SINH", groupColor: EXCEL_GROUP_COLORS.customer };

type CustomerExportRow = Awaited<ReturnType<typeof customerRows>>[number];

async function customerRows(actor: SessionUser, f: CustomerFilters) {
  const rows = await db
    .select({
      id: customers.id,
      fullName: customers.fullName,
      className: customers.className,
      schoolName: schools.name,
      phone: customers.phone,
      parentName: customers.parentName,
      parentPhone: customers.parentPhone,
      status: customers.status,
      submittedAt: customers.submittedAt,
    })
    .from(customers)
    .innerJoin(schools, eq(schools.id, customers.schoolId))
    .where(customerWhere(actor, f))
    .orderBy(...customerOrder);
  const ids = rows.map((r) => r.id);
  const [bankRows, codes] = await Promise.all([banksOf(actor, ids), ids.length ? db.select({ customerId: vouchers.customerId, code: vouchers.code, issuedAt: vouchers.issuedAt }).from(vouchers).where(inArray(vouchers.customerId, ids)) : []]);
  return rows.map((r) => ({ ...r, banks: bankRows.filter((b) => b.customerId === r.id), voucher: codes.find((v) => v.customerId === r.id) ?? null }));
}

const bankColumns = (slot: 1 | 2): ExcelColumn<CustomerExportRow>[] => {
  const g = { group: `NGÂN HÀNG ${slot}`, groupColor: slot === 1 ? EXCEL_GROUP_COLORS.account : EXCEL_GROUP_COLORS.app };
  const bank = (r: CustomerExportRow) => r.banks.find((b) => b.slot === slot);
  return [
    { ...g, header: "NGÂN HÀNG", width: 16, value: (r) => bank(r)?.name ?? "" },
    { ...g, header: "MÃ GIỚI THIỆU", width: 16, type: "text", value: (r) => bank(r)?.referralCode ?? "" },
    { ...g, header: "KẾT QUẢ", width: 14, value: (r) => (bank(r) ? BANK_RESULT[bank(r)!.status] : ""), total: (rows) => rows.filter((r) => bank(r)?.status === "passed").length },
    { ...g, header: "NGƯỜI KIỂM", width: 20, value: (r) => bank(r)?.reviewer ?? "" },
    { ...g, header: "KIỂM LÚC", width: 17, value: (r) => (bank(r)?.reviewedAt ? formatDateTime(bank(r)!.reviewedAt!) : "") },
  ];
};

const CUSTOMER_COLUMNS: ExcelColumn<CustomerExportRow>[] = [
  { ...STUDENT, header: "STT", width: 6, value: (_, i) => i + 1, total: (rows) => rows.length },
  { ...STUDENT, header: "HỌ TÊN", width: 24, transform: "name", value: (r) => r.fullName },
  { ...STUDENT, header: "LỚP", width: 8, value: (r) => r.className },
  { ...STUDENT, header: "TRƯỜNG", width: 26, value: (r) => r.schoolName },
  { ...STUDENT, header: "SĐT", width: 13, type: "text", value: (r) => r.phone },
  { ...STUDENT, header: "PHỤ HUYNH", width: 24, transform: "name", value: (r) => r.parentName },
  { ...STUDENT, header: "SĐT PHỤ HUYNH", width: 14, type: "text", value: (r) => r.parentPhone },
  { ...STUDENT, header: "TRẠNG THÁI", width: 16, value: (r) => CUSTOMER_STATUS_LABEL[r.status] },
  { ...STUDENT, header: "GỬI LÚC", width: 17, value: (r) => (r.submittedAt ? formatDateTime(r.submittedAt) : "") },
  ...bankColumns(1),
  ...bankColumns(2),
  { group: "VOUCHER", groupColor: EXCEL_GROUP_COLORS.gift, header: "MÃ VOUCHER", width: 24, type: "text", value: (r) => r.voucher?.code ?? "", total: (rows) => rows.filter((r) => r.voucher).length },
  { group: "VOUCHER", groupColor: EXCEL_GROUP_COLORS.gift, header: "NGÀY CẤP", width: 17, value: (r) => (r.voucher ? formatDateTime(r.voucher.issuedAt) : "") },
];

export async function exportCustomers(actor: SessionUser, f: CustomerFilters, ip: string | null): Promise<ExportResult> {
  if (!can(actor, "export_excel") || !can(actor, "customers")) return DENIED;
  const [{ n }] = await db.select({ n: count() }).from(customers).where(customerWhere(actor, f));
  if (n > EXPORT_LIMIT) return tooMany(n);
  const rows = await customerRows(actor, f);
  const bytes = await buildExcel({ sheetName: "Hồ sơ học sinh", columns: CUSTOMER_COLUMNS, rows });
  await writeAudit(db, { userId: actor.id, action: "export_excel", targetType: "customers", targetId: "list", detail: { filters: f, rows: rows.length }, ip });
  return { ok: true, bytes, fileName: `ho-so-hoc-sinh-${today()}.xlsx` };
}

type SchoolExportRow = Awaited<ReturnType<typeof allSchools>>[number];
const SCHOOL = { group: "TRƯỜNG", groupColor: EXCEL_GROUP_COLORS.customer };
const COUNTS = { group: "HỒ SƠ HỌC SINH", groupColor: EXCEL_GROUP_COLORS.account };
const SCHOOL_COLUMNS: ExcelColumn<SchoolExportRow>[] = [
  { ...SCHOOL, header: "STT", width: 6, value: (_, i) => i + 1, total: (rows) => rows.length },
  { ...SCHOOL, header: "TRƯỜNG", width: 30, value: (r) => r.name },
  { ...SCHOOL, header: "XÃ/PHƯỜNG", width: 22, value: (r) => r.wardName },
  { ...SCHOOL, header: "TỈNH", width: 20, value: (r) => r.provinceName },
  { ...SCHOOL, header: "NGƯỜI LIÊN HỆ", width: 22, value: (r) => r.contactName },
  { ...SCHOOL, header: "SĐT LIÊN HỆ", width: 14, type: "text", value: (r) => r.contactPhone },
  { ...SCHOOL, header: "TRẠNG THÁI", width: 12, value: (r) => (r.active ? "Đang mở" : "Đã đóng") },
  { ...SCHOOL, header: "LINK QR", width: 40, value: (r) => studentLink(r.id), link: (r) => studentLink(r.id) },
  { ...COUNTS, header: "HỒ SƠ", width: 10, value: (r) => r.customerCount, total: (rows) => rows.reduce((s, r) => s + r.customerCount, 0) },
  { ...COUNTS, header: "ĐẠT ≥ 1", width: 10, value: (r) => r.passedCount, total: (rows) => rows.reduce((s, r) => s + r.passedCount, 0) },
];

export async function exportSchools(actor: SessionUser, q: string, ip: string | null): Promise<ExportResult> {
  if (!can(actor, "export_excel") || !can(actor, "schools")) return DENIED;
  const rows = await allSchools(q, EXPORT_LIMIT + 1);
  if (rows.length > EXPORT_LIMIT) return tooMany(rows.length);
  const bytes = await buildExcel({ sheetName: "Trường", columns: SCHOOL_COLUMNS, rows });
  await writeAudit(db, { userId: actor.id, action: "export_excel", targetType: "schools", targetId: "list", detail: { filters: { q }, rows: rows.length }, ip });
  return { ok: true, bytes, fileName: `truong-${today()}.xlsx` };
}

type VoucherExportRow = Awaited<ReturnType<ReturnType<typeof voucherBase>["execute"]>>[number];
const VOUCHER = { group: "VOUCHER", groupColor: EXCEL_GROUP_COLORS.gift };
const VOUCHER_COLUMNS: ExcelColumn<VoucherExportRow>[] = [
  { ...VOUCHER, header: "STT", width: 6, value: (_, i) => i + 1, total: (rows) => rows.length },
  { ...VOUCHER, header: "MÃ VOUCHER", width: 24, type: "text", value: (r) => r.code },
  { ...VOUCHER, header: "NGÀY CẤP", width: 17, value: (r) => formatDateTime(r.issuedAt) },
  { ...STUDENT, header: "HỌ TÊN", width: 24, transform: "name", value: (r) => r.fullName },
  { ...STUDENT, header: "LỚP", width: 8, value: (r) => r.className },
  { ...STUDENT, header: "TRƯỜNG", width: 26, value: (r) => r.schoolName },
  { ...STUDENT, header: "PHỤ HUYNH", width: 24, transform: "name", value: (r) => r.parentName },
];

export async function exportVouchers(actor: SessionUser, f: VoucherFilters, ip: string | null): Promise<ExportResult> {
  if (!can(actor, "export_excel") || !can(actor, "vouchers")) return DENIED;
  const rows = await voucherBase()
    .where(voucherWhere(f))
    .orderBy(desc(vouchers.issuedAt), desc(vouchers.id))
    .limit(EXPORT_LIMIT + 1);
  if (rows.length > EXPORT_LIMIT) return tooMany(rows.length);
  const bytes = await buildExcel({ sheetName: "Mã voucher", columns: VOUCHER_COLUMNS, rows });
  await writeAudit(db, { userId: actor.id, action: "export_excel", targetType: "vouchers", targetId: "list", detail: { filters: f, rows: rows.length }, ip });
  return { ok: true, bytes, fileName: `ma-voucher-${today()}.xlsx` };
}
