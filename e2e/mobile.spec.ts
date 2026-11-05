import { expect, test, type Browser, type Page } from "@playwright/test";

const PASSWORD = "e2e23test";
const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
const DESKTOP = { viewport: { width: 1366, height: 768 } };

async function loginAs(browser: Browser, username: string, device: object): Promise<Page> {
  const context = await browser.newContext({ baseURL: "http://admin.localhost:3100", ...device });
  // Huy hiệu của dev server nằm góc phải dưới, đè lên nút Thêm ở khổ 390 px; bản chạy thật không có huy hiệu này.
  await context.addInitScript(() =>
    document.addEventListener("DOMContentLoaded", () => document.head.append(Object.assign(document.createElement("style"), { textContent: "nextjs-portal{display:none!important}" }))),
  );
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Tài khoản").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/(users|profile)$/);
  await page.waitForLoadState("networkidle");
  return page;
}

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Điều hướng chính" });
const bottomNav = (page: Page) => page.getByRole("navigation", { name: "Điều hướng nhanh" });

test("điện thoại: thanh đáy có 3 trang nghiệp vụ và nút Thêm, Thêm mở sidebar, chọn mục thì sidebar đóng và chuyển trang", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  await expect(sidebar(page)).toBeHidden();
  await expect(bottomNav(page).getByRole("link")).toHaveText(["Hồ sơ học sinh", "Ngân hàng", "Mã voucher"]);
  const more = bottomNav(page).getByRole("button", { name: "Thêm" });
  await expect(more).toBeVisible();

  await more.click();
  await expect(sidebar(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Đóng menu điều hướng" })).toBeFocused();
  await sidebar(page).getByRole("link", { name: "Cài đặt" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page.getByRole("heading", { level: 1, name: "Cài đặt" })).toBeVisible();
  await expect(sidebar(page)).toBeHidden();

  await bottomNav(page).getByRole("link", { name: "Hồ sơ học sinh" }).click();
  await expect(page).toHaveURL(/\/customers$/);
  await expect(bottomNav(page).getByRole("link", { name: "Hồ sơ học sinh" })).toHaveAttribute("aria-current", "page");
  await expect(bottomNav(page).getByRole("link", { name: "Ngân hàng" })).not.toHaveAttribute("aria-current", "page");
});

test("điện thoại: Esc và bấm lớp phủ đóng sidebar, Esc trả focus về nút Thêm", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", PHONE);
  const more = bottomNav(page).getByRole("button", { name: "Thêm" });
  await more.click();
  await expect(sidebar(page)).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(sidebar(page)).toBeHidden();
  await expect(more).toBeFocused();

  await more.click();
  await expect(sidebar(page)).toBeVisible();
  await page.mouse.click(370, 300);
  await expect(sidebar(page)).toBeHidden();
});

test("điện thoại: Nhân viên không có quyền trang nghiệp vụ nào thì thanh đáy chỉ có nút Thêm", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_staff", PHONE);
  await expect(bottomNav(page).getByRole("link")).toHaveCount(0);
  await expect(bottomNav(page).getByRole("button", { name: "Thêm" })).toBeVisible();
});

test("máy tính 1366x768: không có thanh đáy, sidebar hiện sẵn", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin", DESKTOP);
  await expect(bottomNav(page)).toBeHidden();
  await expect(sidebar(page)).toBeVisible();
  await expect(page.getByRole("button", { name: "Đóng menu điều hướng" })).toBeHidden();
  expect(await sidebar(page).evaluate((el) => el.getBoundingClientRect().left)).toBe(0);
});
