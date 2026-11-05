import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "./db/client";
import { photoChecks } from "./db/schema";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

// Mỗi dòng ngân hàng chỉ có một lượt chờ: xoá lượt pending cũ rồi thêm lượt mới, trong transaction của thao tác gây ra.
export async function queuePhotoChecks(tx: Tx, customerBankIds: string[]): Promise<void> {
  if (!customerBankIds.length) return;
  await tx.delete(photoChecks).where(and(inArray(photoChecks.customerBankId, customerBankIds), eq(photoChecks.status, "pending")));
  await tx.insert(photoChecks).values(customerBankIds.map((customerBankId) => ({ customerBankId })));
  // Postgres chỉ phát thông báo sau commit, worker không đọc trước lúc dòng có thật.
  for (const id of customerBankIds) await tx.execute(sql`select pg_notify('photo_checks', ${id})`);
}
