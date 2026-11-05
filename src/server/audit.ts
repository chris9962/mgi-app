import { isIP } from "node:net";
import { db } from "./db/client";
import { auditLog } from "./db/schema";

type Executor = Pick<typeof db, "insert">;

export type AuditEntry = { userId: string; action: string; targetType: string; targetId: string; detail?: unknown; ip?: string | null };

export async function writeAudit(executor: Executor, entry: AuditEntry): Promise<void> {
  await executor.insert(auditLog).values({ ...entry, detail: entry.detail ?? null, ip: entry.ip && isIP(entry.ip) ? entry.ip : null });
}

export const ipFrom = (request: Request): string | null => request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
