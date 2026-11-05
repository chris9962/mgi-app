import type { Permission, SessionUser } from "./types";

// Hàm kiểm quyền duy nhất. Giao diện dùng để ẩn hiện, máy chủ dùng để chặn: hai nơi hỏi cùng một câu.
export const ACTIONS = ["users", "system", "customers", "manage_banks", "export_excel", "schools", "vouchers"] as const;
export type Action = (typeof ACTIONS)[number];

const GRANTABLE: readonly string[] = ["manage_banks", "export_excel", "schools", "vouchers"] satisfies Permission[];

export function can(user: SessionUser, action: Action): boolean {
  if (user.role === "admin") return true;
  if (action === "system") return false;
  if (user.role === "manager") return true;
  if (action === "customers") return user.managedBankIds.length > 0;
  return GRANTABLE.includes(action) && user.permissions.includes(action as Permission);
}

export type CustomerScope = { all: true } | { all: false; bankIds: string[] };

export function customerScope(user: SessionUser): CustomerScope {
  return user.role === "staff" ? { all: false, bankIds: user.managedBankIds } : { all: true };
}
