import type { Page } from "@playwright/test";

// Sidebar chỉ mở sẵn nhóm chứa trang đang xem (như mgst-app): test tìm link ở nhóm khác phải mở nhóm trước.
export async function openSidebarGroups(page: Page) {
  const closed = page.locator('#main-nav ul > li > button[aria-expanded="false"]');
  while ((await closed.count()) > 0) await closed.first().click();
}
