import { and, asc, count, eq, inArray, ne, or, sql } from "drizzle-orm";
import { db } from "./db/client";
import { banks, sessions, userManagedBanks, userPermissions, users } from "./db/schema";
import { generatePassword, hashPassword } from "./auth/password";
import { writeAudit } from "./audit";
import { matchesPlain } from "./search";
import type { Permission, Role, SessionUser } from "@/lib/types";
import type { UserFormValues } from "@/lib/userForm";

export const PAGE_SIZE = 15;

export type UserRow = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  title: string;
  active: boolean;
  lockedUntil: Date | null;
  permissions: Permission[];
  managedBanks: string[];
};

export type UserDetail = UserRow & { staffCode: string | null; phone: string | null };

type Fail = { ok: false; message: string; field?: keyof UserFormValues; status: 400 | 404 | 409 };
const fail = (message: string, status: Fail["status"] = 400, field?: Fail["field"]): Fail => ({ ok: false, message, status, field });

async function decorate(rows: (typeof users.$inferSelect)[]): Promise<UserDetail[]> {
  const ids = rows.map((r) => r.id);
  if (!ids.length) return [];
  const [perms, managed] = await Promise.all([
    db.select().from(userPermissions).where(inArray(userPermissions.userId, ids)),
    db
      .select({ userId: userManagedBanks.userId, name: banks.name })
      .from(userManagedBanks)
      .innerJoin(banks, eq(banks.id, userManagedBanks.bankId))
      .where(inArray(userManagedBanks.userId, ids))
      .orderBy(asc(banks.sortOrder), asc(banks.name)),
  ]);
  return rows.map((r) => ({
    id: r.id,
    username: r.username,
    fullName: r.fullName,
    role: r.role,
    title: r.title,
    active: r.active,
    staffCode: r.staffCode,
    phone: r.phone,
    lockedUntil: r.lockedUntil,
    permissions: perms.filter((p) => p.userId === r.id).map((p) => p.permission).sort(),
    managedBanks: managed.filter((m) => m.userId === r.id).map((m) => m.name),
  }));
}

export async function listUsers({ q, page }: { q: string; page: number }): Promise<{ rows: UserRow[]; total: number; page: number }> {
  const term = q.trim();
  const where = term ? or(matchesPlain(users.fullName, term), matchesPlain(users.username, term)) : undefined;
  const [{ total }] = await db.select({ total: count() }).from(users).where(where);
  const safePage = Math.min(Math.max(1, Math.trunc(page) || 1), Math.max(1, Math.ceil(total / PAGE_SIZE)));
  const rows = await db
    .select()
    .from(users)
    .where(where)
    .orderBy(sql`case ${users.role} when 'admin' then 0 when 'manager' then 1 else 2 end`, asc(users.fullName), asc(users.id))
    .limit(PAGE_SIZE)
    .offset((safePage - 1) * PAGE_SIZE);
  return { rows: await decorate(rows), total, page: safePage };
}

export async function getUser(id: string): Promise<UserDetail | null> {
  const [row] = await db.select().from(users).where(eq(users.id, id));
  return row ? (await decorate([row]))[0] : null;
}

// Quản lý có mọi quyền như Quản trị, nhưng không đụng tới tài khoản Quản trị: nếu được thì Quản lý tự nâng mình lên Quản trị và luật "Hệ thống chỉ Quản trị" mất tác dụng.
function guardAdmin(actor: SessionUser, targetRole: Role | null, nextRole: Role | null): Fail | null {
  if (actor.role === "admin") return null;
  if (targetRole === "admin" || nextRole === "admin") return fail("Chỉ Quản trị thao tác được với tài khoản Quản trị.", 400);
  return null;
}

async function conflictOf(values: UserFormValues, exceptId?: string): Promise<Fail | null> {
  const others = exceptId ? ne(users.id, exceptId) : undefined;
  const [byName] = await db.select({ id: users.id }).from(users).where(and(eq(users.username, values.username), others));
  if (byName) return fail("Tên đăng nhập đã có.", 409, "username");
  if (values.staffCode) {
    const [byCode] = await db.select({ id: users.id }).from(users).where(and(eq(users.staffCode, values.staffCode), others));
    if (byCode) return fail("Mã tài khoản đã có.", 409, "staffCode");
  }
  return null;
}

// Quản trị và Quản lý có sẵn mọi quyền, nên chỉ Nhân viên lưu dòng quyền.
const permissionsFor = (values: UserFormValues) => (values.role === "staff" ? [...new Set(values.permissions)] : []);

export async function createUser(actor: SessionUser, values: UserFormValues, ip?: string | null): Promise<{ ok: true; id: string; password: string } | Fail> {
  const denied = guardAdmin(actor, null, values.role) ?? (await conflictOf(values));
  if (denied) return denied;
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  const id = await db.transaction(async (tx) => {
    const [row] = await tx
      .insert(users)
      .values({ username: values.username, staffCode: values.staffCode, phone: values.phone, fullName: values.fullName, role: values.role, title: values.title, passwordHash })
      .returning({ id: users.id });
    const perms = permissionsFor(values);
    if (perms.length) await tx.insert(userPermissions).values(perms.map((permission) => ({ userId: row.id, permission })));
    await writeAudit(tx, { userId: actor.id, action: "create_user", targetType: "users", targetId: row.id, detail: { ...values, permissions: perms }, ip });
    return row.id;
  });
  return { ok: true, id, password };
}

export async function updateUser(actor: SessionUser, id: string, values: UserFormValues, ip?: string | null): Promise<{ ok: true } | Fail> {
  const before = await getUser(id);
  if (!before) return fail("Không tìm thấy tài khoản.", 404);
  if (actor.id === id && values.role !== before.role) return fail("Không tự đổi vai của chính mình.", 400, "role");
  const denied = guardAdmin(actor, before.role, values.role) ?? (await conflictOf(values, id));
  if (denied) return denied;
  const perms = permissionsFor(values);
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set({ username: values.username, staffCode: values.staffCode, phone: values.phone, fullName: values.fullName, role: values.role, title: values.title, updatedAt: new Date() })
      .where(eq(users.id, id));
    await tx.delete(userPermissions).where(eq(userPermissions.userId, id));
    if (perms.length) await tx.insert(userPermissions).values(perms.map((permission) => ({ userId: id, permission })));
    await writeAudit(tx, {
      userId: actor.id,
      action: "update_user",
      targetType: "users",
      targetId: id,
      detail: { before: { ...before, managedBanks: undefined }, after: { ...values, permissions: perms } },
      ip,
    });
  });
  return { ok: true };
}

export async function setActive(actor: SessionUser, id: string, active: boolean, ip?: string | null): Promise<{ ok: true } | Fail> {
  if (actor.id === id) return fail("Không tự khoá tài khoản của chính mình.");
  const target = await getUser(id);
  if (!target) return fail("Không tìm thấy tài khoản.", 404);
  const denied = guardAdmin(actor, target.role, null);
  if (denied) return denied;
  await db.transaction(async (tx) => {
    await tx
      .update(users)
      .set(active ? { active, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() } : { active, updatedAt: new Date() })
      .where(eq(users.id, id));
    if (!active) await tx.delete(sessions).where(eq(sessions.userId, id));
    await writeAudit(tx, { userId: actor.id, action: active ? "unlock_user" : "lock_user", targetType: "users", targetId: id, ip });
  });
  return { ok: true };
}

export async function resetPassword(actor: SessionUser, id: string, ip?: string | null): Promise<{ ok: true; password: string } | Fail> {
  const target = await getUser(id);
  if (!target) return fail("Không tìm thấy tài khoản.", 404);
  const denied = guardAdmin(actor, target.role, null);
  if (denied) return denied;
  const password = generatePassword();
  const passwordHash = await hashPassword(password);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, failedAttempts: 0, lockedUntil: null, updatedAt: new Date() }).where(eq(users.id, id));
    await tx.delete(sessions).where(eq(sessions.userId, id));
    await writeAudit(tx, { userId: actor.id, action: "reset_password", targetType: "users", targetId: id, ip });
  });
  return { ok: true, password };
}
