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

// Băm giả để tên không có thật cũng tốn thời gian như sai mật khẩu, không đo thời gian mà dò ra tên.
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.0OzmMrrBG9.PeVpqEJcR0n.5vHWa";

// Tên không có thật cũng đếm lượt sai và bị "khoá" như tên có thật, để thông báo khoá không cho biết tên nào tồn tại.
// Lưu trong bộ nhớ vì app chạy một tiến trình; khởi động lại thì mất số đếm, chỉ làm yếu đi phần giả lập.
const phantom = new Map<string, { attempts: number; lockedUntil: number }>();
const LOCK_MS = LOGIN_LOCK_MINUTES * 60 * 1000;

async function phantomAttempt(username: string, password: string): Promise<LoginResult> {
  const now = Date.now();
  const entry = phantom.get(username);
  if (entry && entry.lockedUntil > now) return LOCKED;
  await verifyPassword(password, DUMMY_HASH);
  const attempts = (entry && entry.lockedUntil === 0 ? entry.attempts : 0) + 1;
  if (phantom.size > 10_000) for (const [k, v] of phantom) if (v.lockedUntil !== 0 && v.lockedUntil <= now) phantom.delete(k);
  if (attempts >= LOGIN_MAX_ATTEMPTS) {
    phantom.set(username, { attempts: 0, lockedUntil: now + LOCK_MS });
    return LOCKED;
  }
  phantom.set(username, { attempts, lockedUntil: 0 });
  return BAD;
}

export async function attemptLogin(rawUsername: string, password: string): Promise<LoginResult> {
  const username = rawUsername.trim().toLowerCase();
  const [account] = await db.select().from(users).where(eq(users.username, username));
  if (!account || !account.active) return phantomAttempt(username, password);

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
