import { eq } from "drizzle-orm";
import { customerBanks, customers } from "./db/schema";
import type { Tx } from "./photoChecks";
import type { CustomerStatus } from "@/lib/studentState";

// Trạng thái hồ sơ suy từ các dòng ngân hàng (gửi kiểm tra từng ngân hàng, chốt 2026-11-17):
// không dòng là Mới; có dòng mà chưa gửi dòng nào là Đã chọn ngân hàng; đã gửi ít nhất một dòng là Chờ kiểm tra
// tới khi mọi dòng đã gửi được kiểm và không còn dòng đang chọn thì Đã kiểm tra.
export async function syncCustomerStatus(tx: Tx, customerId: string): Promise<CustomerStatus> {
  const rows = await tx.select({ status: customerBanks.status }).from(customerBanks).where(eq(customerBanks.customerId, customerId));
  const selected = rows.some((r) => r.status === "selected");
  const submitted = rows.some((r) => r.status !== "selected");
  const pending = rows.some((r) => r.status === "pending");
  const status: CustomerStatus = !rows.length ? "new" : !submitted ? "banks_selected" : pending || selected ? "pending_review" : "reviewed";
  await tx.update(customers).set({ status }).where(eq(customers.id, customerId));
  return status;
}
