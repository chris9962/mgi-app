import { and, asc, count, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db } from "./db/client";
import { customers, provinces, schools, wards } from "./db/schema";
import { writeAudit } from "./audit";
import type { SessionUser } from "@/lib/types";
import type { SchoolFormValues } from "@/lib/schoolForm";

export const PAGE_SIZE = 15;

export type SchoolRow = {
  id: string;
  name: string;
  provinceCode: string;
  wardCode: string;
  wardName: string;
  provinceName: string;
  contactName: string;
  contactPhone: string;
  active: boolean;
  customerCount: number;
  passedCount: number;
};

type Fail = { ok: false; message: string; field?: string; status: 400 | 404 };

const SCHOOL_ID = sql.raw(`"schools"."id"`);

const columns = {
  id: schools.id,
  name: schools.name,
  provinceCode: wards.provinceCode,
  wardCode: schools.wardCode,
  wardName: wards.name,
  provinceName: provinces.name,
  contactName: schools.contactName,
  contactPhone: schools.contactPhone,
  active: schools.active,
  // Đếm cho đúng các dòng của trang, mỗi dòng một lượt tra chỉ mục customers(school_id, created_at).
  // Ghi rõ tên bảng trong câu con để cột không trỏ nhầm sang bảng con.
  customerCount: sql<number>`(select count(*)::int from ${customers} c where c.school_id = ${SCHOOL_ID})`,
  passedCount: sql<number>`(select count(*)::int from ${customers} c where c.school_id = ${SCHOOL_ID} and c.first_passed_at is not null)`,
};

const base = () => db.select(columns).from(schools).innerJoin(wards, eq(wards.code, schools.wardCode)).innerJoin(provinces, eq(provinces.code, wards.provinceCode));

export async function listSchools({ q, page }: { q: string; page: number }): Promise<{ rows: SchoolRow[]; total: number; page: number }> {
  const term = q.trim();
  const where = term ? or(ilike(schools.name, `%${term}%`), ilike(wards.name, `%${term}%`)) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(schools).innerJoin(wards, eq(wards.code, schools.wardCode)).where(where);
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const rows = await base()
    .where(where)
    .orderBy(sql`${schools.active} desc`, asc(schools.name), asc(schools.id))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);
  return { rows, total, page: safePage };
}

export async function getSchool(id: string): Promise<SchoolRow | null> {
  const [row] = await base().where(eq(schools.id, id));
  return row ?? null;
}

async function wardFails(values: SchoolFormValues): Promise<Fail | null> {
  const [ward] = await db.select({ code: wards.code }).from(wards).where(and(eq(wards.code, values.wardCode), eq(wards.provinceCode, values.provinceCode)));
  return ward ? null : { ok: false, message: "Xã/phường không thuộc tỉnh đã chọn.", field: "wardCode", status: 400 };
}

const record = (values: SchoolFormValues) => ({ name: values.name, wardCode: values.wardCode, contactName: values.contactName, contactPhone: values.contactPhone });

export async function createSchool(actor: SessionUser, values: SchoolFormValues, ip?: string | null): Promise<{ ok: true; id: string } | Fail> {
  const denied = await wardFails(values);
  if (denied) return denied;
  const id = await db.transaction(async (tx) => {
    const [row] = await tx.insert(schools).values({ ...record(values), createdBy: actor.id }).returning({ id: schools.id });
    await writeAudit(tx, { userId: actor.id, action: "create_school", targetType: "schools", targetId: row.id, detail: values, ip });
    return row.id;
  });
  return { ok: true, id };
}

export async function updateSchool(actor: SessionUser, id: string, values: SchoolFormValues, ip?: string | null): Promise<{ ok: true } | Fail> {
  const before = await getSchool(id);
  if (!before) return { ok: false, message: "Không tìm thấy trường.", status: 404 };
  const denied = await wardFails(values);
  if (denied) return denied;
  await db.transaction(async (tx) => {
    await tx.update(schools).set(record(values)).where(eq(schools.id, id));
    await writeAudit(tx, { userId: actor.id, action: "update_school", targetType: "schools", targetId: id, detail: { before, after: values }, ip });
  });
  return { ok: true };
}

export async function setSchoolActive(actor: SessionUser, id: string, active: boolean, ip?: string | null): Promise<{ ok: true } | Fail> {
  const [row] = await db.update(schools).set({ active }).where(eq(schools.id, id)).returning({ id: schools.id });
  if (!row) return { ok: false, message: "Không tìm thấy trường.", status: 404 };
  await writeAudit(db, { userId: actor.id, action: active ? "open_school" : "close_school", targetType: "schools", targetId: id, ip });
  return { ok: true };
}

// Tên xã bỏ tiền tố "Xã", "Phường" cho ngắn: "THPT Nguyễn Du - Châu Thành".
const shortWard = (name: string) => name.replace(/^(Xã|Phường|Thị trấn|Đặc khu)\s+/, "");

export async function searchSchoolOptions(q: string): Promise<{ id: string; label: string }[]> {
  const term = q.trim();
  const rows = await db
    .select({ id: schools.id, name: schools.name, ward: wards.name })
    .from(schools)
    .innerJoin(wards, eq(wards.code, schools.wardCode))
    .where(and(eq(schools.active, true), term ? or(ilike(schools.name, `%${term}%`), ilike(wards.name, `%${term}%`)) : undefined))
    .orderBy(asc(schools.name))
    .limit(20);
  return rows.map((r) => ({ id: r.id, label: `${r.name} - ${shortWard(r.ward)}` }));
}

export async function schoolLabels(ids: string[]): Promise<{ id: string; label: string }[]> {
  if (!ids.length) return [];
  const rows = await db
    .select({ id: schools.id, name: schools.name, ward: wards.name })
    .from(schools)
    .innerJoin(wards, eq(wards.code, schools.wardCode))
    .where(inArray(schools.id, ids));
  return rows.map((r) => ({ id: r.id, label: `${r.name} - ${shortWard(r.ward)}` }));
}

export const listProvinces = () => db.select().from(provinces).orderBy(asc(provinces.name));
export const listWards = (provinceCode: string) => db.select({ code: wards.code, name: wards.name }).from(wards).where(eq(wards.provinceCode, provinceCode)).orderBy(asc(wards.name));
