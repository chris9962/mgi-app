import type { MenuGroup, MenuItem } from "./menu";

const BOTTOM_HREFS = ["/customers", "/customer-banks", "/vouchers"];

// Lấy từ menu đã lọc theo quyền của sidebar, nên thanh đáy không có luật quyền riêng.
export const bottomNavItems = (groups: MenuGroup[]): MenuItem[] => {
  const items = groups.flatMap((g) => g.items);
  return BOTTOM_HREFS.flatMap((href) => items.filter((i) => i.href === href));
};
