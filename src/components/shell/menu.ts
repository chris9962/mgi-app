import { can, canManageAnyBank } from "@/lib/permissions";
import type { SessionUser } from "@/lib/types";

export type MenuItem = { href: string; label: string; exact?: boolean; badge?: number };
type MenuEntry = MenuItem & { allow: (user: SessionUser) => boolean };
export type MenuGroup = { key: string; label: string; items: MenuItem[] };

// Chỉ liệt kê trang đã có. Thêm trang ở giai đoạn sau thì thêm dòng vào đây.
const MENU: { key: string; label: string; items: MenuEntry[] }[] = [
  { key: "work", label: "Nghiệp vụ", items: [{ href: "/customers", label: "Hồ sơ học sinh", allow: (u) => can(u, "customers") }] },
  {
    key: "data",
    label: "Cấu hình dữ liệu",
    items: [
      { href: "/schools", label: "Trường", allow: (u) => can(u, "schools") },
      { href: "/banks", label: "Ngân hàng", exact: true, allow: canManageAnyBank },
      { href: "/banks/codes", label: "Mã giới thiệu", allow: canManageAnyBank },
      { href: "/vouchers", label: "Mã voucher", allow: (u) => can(u, "vouchers") },
    ],
  },
  { key: "manage", label: "Quản lý", items: [{ href: "/users", label: "Tài khoản", allow: (u) => can(u, "users") }] },
  {
    key: "system",
    label: "Hệ thống",
    items: [
      { href: "/sms", label: "Tin SMS lỗi", allow: (u) => can(u, "customers") },
      { href: "/settings", label: "Cài đặt", allow: (u) => can(u, "system") },
      { href: "/ops", label: "Vận hành hệ thống", allow: (u) => can(u, "system") },
    ],
  },
];

// badges: số hiện cạnh mục menu theo href, ví dụ số tin SMS lỗi trong phạm vi người xem.
export const menuFor = (user: SessionUser, badges: Record<string, number> = {}): MenuGroup[] =>
  MENU.map((g) => ({
    key: g.key,
    label: g.label,
    items: g.items.filter((i) => i.allow(user)).map(({ href, label, exact }) => ({ href, label, exact, badge: badges[href] || undefined })),
  })).filter((g) => g.items.length);
