import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { customers, schools } from "./db/schema";
import { hashToken } from "./auth/session";
import type { StudentState } from "@/lib/studentState";

export type Customer = typeof customers.$inferSelect;

// Học sinh không có tài khoản: token trên điện thoại là thứ duy nhất chứng minh hồ sơ là của mình.
export function newCustomerToken(): { token: string; tokenHash: string } {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

export function bearerToken(request: Request): string | null {
  const m = /^Bearer\s+([A-Za-z0-9_-]{43})$/.exec(request.headers.get("authorization") ?? "");
  return m ? m[1] : null;
}

export async function customerFromRequest(request: Request): Promise<Customer | null> {
  const token = bearerToken(request);
  if (!token) return null;
  const [row] = await db.select().from(customers).where(eq(customers.tokenHash, hashToken(token)));
  return row ?? null;
}

export async function touchCustomer(id: string): Promise<void> {
  await db.update(customers).set({ lastSeenAt: new Date() }).where(eq(customers.id, id));
}

export async function studentState(customer: Customer): Promise<StudentState> {
  const [school] = await db.select({ id: schools.id, name: schools.name }).from(schools).where(eq(schools.id, customer.schoolId));
  return {
    customer: { id: customer.id, fullName: customer.fullName, className: customer.className, status: customer.status },
    school,
  };
}
