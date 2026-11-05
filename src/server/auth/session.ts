import { createHash, randomBytes } from "node:crypto";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/client";
import { sessions, userManagedBanks, userPermissions, users } from "../db/schema";
import type { SessionUser } from "@/lib/types";
import { cookieSettings, sessionCookieHeader } from "./cookie";

const COOKIE = cookieSettings();
export const SESSION_COOKIE = COOKIE.name;
export const SESSION_MAX_AGE_S = 365 * 24 * 60 * 60;

// DB chỉ giữ băm của token: lộ bản sao DB không lấy được phiên đang sống.
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<{ token: string; cookie: string; expiresAt: Date }> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_S * 1000);
  await db.insert(sessions).values({ tokenHash: hashToken(token), userId, expiresAt });
  const cookie = sessionCookieHeader(COOKIE, token, SESSION_MAX_AGE_S);
  return { token, cookie, expiresAt };
}

export const expiredCookie = () => sessionCookieHeader(COOKIE, "", 0);

export async function destroySession(token: string | null): Promise<void> {
  if (token) await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
}

export function tokenFromRequest(request: Request): string | null {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return rest.join("=") || null;
  }
  return null;
}

export async function loadSessionUser(userId: string): Promise<SessionUser | null> {
  const [row] = await db.select().from(users).where(and(eq(users.id, userId), eq(users.active, true)));
  if (!row) return null;
  const [perms, banks] = await Promise.all([
    db.select({ p: userPermissions.permission }).from(userPermissions).where(eq(userPermissions.userId, userId)),
    db.select({ b: userManagedBanks.bankId }).from(userManagedBanks).where(eq(userManagedBanks.userId, userId)),
  ]);
  return {
    id: row.id,
    username: row.username,
    fullName: row.fullName,
    role: row.role,
    title: row.title,
    phone: row.phone,
    permissions: perms.map((r) => r.p).sort(),
    managedBankIds: banks.map((r) => r.b).sort(),
  };
}

export async function userFromToken(token: string | null): Promise<SessionUser | null> {
  if (!token) return null;
  const [row] = await db
    .select({ userId: sessions.userId })
    .from(sessions)
    .where(and(eq(sessions.tokenHash, hashToken(token)), gt(sessions.expiresAt, new Date())));
  return row ? loadSessionUser(row.userId) : null;
}
