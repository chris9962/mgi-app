import { StatusTag } from "@/components/ui/StatusTag";
import { PERMISSION_LABEL } from "@/lib/types";
import type { UserRow } from "@/server/users";

export const permissionText = (u: UserRow) =>
  u.role !== "staff" ? <span className="text-text-3">Toàn quyền</span> : u.permissions.length ? u.permissions.map((p) => PERMISSION_LABEL[p]).join(", ") : <span className="text-text-3">Chưa cấp</span>;

export const bankText = (u: UserRow) =>
  u.role !== "staff" ? <span className="text-text-3">Mọi ngân hàng</span> : u.managedBanks.length ? u.managedBanks.join(", ") : <span className="text-text-3">Chưa giao</span>;

export const statusTag = (u: UserRow) => (u.active ? <StatusTag tone="ok">Đang hoạt động</StatusTag> : <StatusTag tone="neutral">Đã khoá</StatusTag>);

export const formDefaults = (u: UserRow & { staffCode?: string | null; phone?: string | null }) => ({
  id: u.id,
  fullName: u.fullName,
  staffCode: u.staffCode ?? "",
  phone: u.phone ?? "",
  username: u.username,
  role: u.role,
  title: u.title,
  permissions: u.permissions,
  active: u.active,
});
