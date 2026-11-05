export const ROLES = ["admin", "manager", "staff"] as const;
export type Role = (typeof ROLES)[number];

export const PERMISSIONS = ["manage_banks", "export_excel", "schools", "vouchers"] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const ROLE_LABEL: Record<Role, string> = { admin: "Quản trị", manager: "Quản lý", staff: "Nhân viên" };

export const PERMISSION_LABEL: Record<Permission, string> = {
  manage_banks: "Quản lý ngân hàng",
  export_excel: "Xuất Excel",
  schools: "Trường và QR",
  vouchers: "Quản lý voucher",
};

export type SessionUser = {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  title: string;
  phone: string | null;
  permissions: Permission[];
  managedBankIds: string[];
};

export const LOGIN_MAX_ATTEMPTS = 5;
export const LOGIN_LOCK_MINUTES = 15;
