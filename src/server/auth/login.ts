import { and, eq, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db/client";
import { users } from "../db/schema";
import { verifyPassword } from "./password";
import { LOGIN_LOCK_MINUTES, LOGIN_MAX_ATTEMPTS } from "@/lib/types";

export type LoginResult =
  | { ok: true; userId: string; code?: undefined; message?: undefined }
  | { ok: false; code: "bad_credentials" | "locked"; message: string };

const BAD: LoginResult = { ok: false, code: "bad_credentials", message: "Tên đăng nhập hoặc mật khẩu không đúng." };
const LOCKED: LoginResult = {
  ok: false,
  code: "locked",
  message: `Sai ${LOGIN_MAX_ATTEMPTS} lần liên tiếp, tài khoản bị khoá ${LOGIN_LOCK_MINUTES} phút. Liên hệ quản trị để mở lại.`,
};

// Băm giả để tên không có thật cũng tốn thời gian như sai mật khẩu, không đo giờ mà dò ra tên.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.0OzmMrrBG9.PeVpqEJcR0n.5vHWa";

export async function attemptLogin(rawUsername: string, password: string): Promise<LoginResult> {
  const username = rawUsername.trim().toLowerCase();
  const [account] = await db.select().from(users).where(eq(users.username, username));
  if (!account || !account.active) {
    await verifyPassword(password, DUMMY_HASH);
    return BAD;
  }

  // Nhận lượt thử bằng một câu update nguyên tử trước khi băm. Gửi nhiều request cùng lúc thì mỗi request nhận một số thứ tự riêng.
  const stillOpen = or(isNull(users.lockedUntil), lte(users.lockedUntil, sql`now()`));
  const [slot] = await db
    .update(users)
    .set({ failedAttempts: sql`${users.failedAttempts} + 1` })
    .where(and(eq(users.id, account.id), stillOpen))
    .returning({ attempts: users.failedAttempts });
  if (!slot) return LOCKED;

  const lockNow = async () => {
    await db
      .update(users)
      .set({ failedAttempts: 0, lockedUntil: sql`now() + make_interval(mins => ${LOGIN_LOCK_MINUTES})` })
      .where(eq(users.id, account.id));
    return LOCKED;
  };

  if (slot.attempts > LOGIN_MAX_ATTEMPTS) return lockNow();

  if (!(await verifyPassword(password, account.passwordHash))) {
    return slot.attempts >= LOGIN_MAX_ATTEMPTS ? lockNow() : BAD;
  }

  // Chỉ xoá bộ đếm khi hàng chưa bị khoá trong lúc băm, để lần đoán đúng trong một đợt request song song không gỡ khoá.
  const [cleared] = await db
    .update(users)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(and(eq(users.id, account.id), stillOpen))
    .returning({ id: users.id });
  return cleared ? { ok: true, userId: account.id } : LOCKED;
}
