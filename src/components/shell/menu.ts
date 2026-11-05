import type { Action } from "@/lib/permissions";

export type MenuItem = { href: string; label: string; action?: Action };
export type MenuGroup = { key: string; label: string; items: MenuItem[] };

// Chỉ liệt kê trang đã có. Thêm trang ở giai đoạn sau thì thêm dòng vào đây.
export const MENU: MenuGroup[] = [
  { key: "data", label: "Cấu hình dữ liệu", items: [{ href: "/schools", label: "Trường", action: "schools" }] },
  { key: "manage", label: "Quản lý", items: [{ href: "/users", label: "Tài khoản", action: "users" }] },
];
