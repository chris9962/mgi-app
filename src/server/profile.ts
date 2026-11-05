import { and, eq, ne } from "drizzle-orm";
import { db } from "./db/client";
import { sessions, users } from "./db/schema";
import { hashPassword, verifyPassword } from "./auth/password";
import { writeAudit } from "./audit";
import type { SessionUser } from "@/lib/types";
import type { InfoFormValues, PasswordFormValues } from "@/lib/profileForm";

type Fail = { ok: false; message: string; field?: string; status: 400 | 404 };

export async function changeOwnPassword(
  user: SessionUser,
  currentSessionHash: string | null,
  form: PasswordFormValues,
  ip?: string | null,
): Promise<{ ok: true } | Fail> {
  const [row] = await db.select({ hash: users.passwordHash }).from(users).where(eq(users.id, user.id));
  if (!row) return { ok: false, message: "Không tìm thấy tài khoản.", status: 404 };
  if (!(await verifyPassword(form.currentPassword, row.hash))) {
    return { ok: false, message: "Mật khẩu hiện tại không đúng.", field: "currentPassword", status: 400 };
  }
  const passwordHash = await hashPassword(form.newPassword);
  await db.transaction(async (tx) => {
    await tx.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.id, user.id));
    // Giữ phiên đang dùng: đổi mật khẩu xong mà bị đăng xuất ngay thì người đổi tưởng lỗi.
    await tx
      .delete(sessions)
      .where(currentSessionHash ? and(eq(sessions.userId, user.id), ne(sessions.tokenHash, currentSessionHash)) : eq(sessions.userId, user.id));
    await writeAudit(tx, { userId: user.id, action: "change_own_password", targetType: "users", targetId: user.id, ip });
  });
  return { ok: true };
}

export async function updateOwnInfo(user: SessionUser, form: InfoFormValues, ip?: string | null): Promise<{ ok: true }> {
  await db.transaction(async (tx) => {
    await tx.update(users).set({ fullName: form.fullName, phone: form.phone, updatedAt: new Date() }).where(eq(users.id, user.id));
    await writeAudit(tx, { userId: user.id, action: "update_own_info", targetType: "users", targetId: user.id, detail: { before: { fullName: user.fullName, phone: user.phone }, after: form }, ip });
  });
  return { ok: true };
}
