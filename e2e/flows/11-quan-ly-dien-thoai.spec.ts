import type { Locator, Page } from "@playwright/test";
import { flowVideo } from "./video";
import { PHONE, expect, loginAs, sidebar, test } from "./support";

test.use({ ...PHONE, video: flowVideo(390, 844), permissions: ["clipboard-read", "clipboard-write"] });

const bottomNav = (page: Page) => page.getByRole("navigation", { name: "Điều hướng nhanh" });
const box = (locator: Locator) => locator.evaluate((el) => el.getBoundingClientRect().toJSON() as { left: number; right: number; top: number; bottom: number });
const pageWidth = (page: Page) => page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));

test("Flow 11: trang quản lý trên điện thoại: thanh đáy, sidebar trượt, bảng cuộn trong khung, Bộ lọc trọn màn hình, Chép link", async ({ page }) => {
  await test.step("Quản trị đăng nhập trên điện thoại: thanh đáy có 3 trang và nút Thêm", async () => {
    await loginAs(page, "zz_e2e_admin");
    await expect(sidebar(page)).toBeHidden();
    await expect(bottomNav(page).getByRole("link")).toHaveText(["Hồ sơ học sinh", "Ngân hàng", "Mã voucher"]);
    await expect(bottomNav(page).getByRole("button", { name: "Thêm" })).toBeVisible();
  });

  await test.step("Nút Thêm mở sidebar trượt, chọn Cài đặt thì sidebar đóng và chuyển trang", async () => {
    await bottomNav(page).getByRole("button", { name: "Thêm" }).click();
    await expect(sidebar(page)).toBeVisible();
    await sidebar(page).getByRole("link", { name: "Cài đặt" }).click();
    await expect(page).toHaveURL(/\/settings$/);
    await expect(page.getByRole("heading", { level: 1, name: "Cài đặt" })).toBeVisible();
    await expect(sidebar(page)).toBeHidden();
  });

  await test.step("Thanh đáy chuyển sang Hồ sơ học sinh, mục đang mở được đánh dấu", async () => {
    await bottomNav(page).getByRole("link", { name: "Hồ sơ học sinh" }).click();
    await expect(page).toHaveURL(/\/customers$/);
    await page.waitForLoadState("networkidle");
    await expect(bottomNav(page).getByRole("link", { name: "Hồ sơ học sinh" })).toHaveAttribute("aria-current", "page");
  });

  await test.step("Bảng cuộn ngang trong khung, trang không cuộn ngang", async () => {
    const scroller = page.getByRole("region", { name: "Hồ sơ học sinh" }).locator(".table-scroll");
    const before = await scroller.evaluate((el) => ({ scroll: el.scrollWidth, client: el.clientWidth }));
    expect(before.scroll).toBeGreaterThan(before.client);
    await scroller.evaluate((el) => el.scrollTo({ left: el.scrollWidth, behavior: "smooth" }));
    await expect.poll(() => scroller.evaluate((el) => el.scrollLeft)).toBeGreaterThan(0);
    const width = await pageWidth(page);
    expect(width.scroll).toBe(width.client);
    await scroller.evaluate((el) => el.scrollTo({ left: 0, behavior: "smooth" }));
  });

  await test.step("Bảng Bộ lọc nằm trọn màn hình, trên thanh đáy", async () => {
    await page.getByRole("button", { name: "Bộ lọc" }).click();
    const nav = page.getByRole("navigation", { name: "Mục lọc" });
    const panel = await box(nav.locator("xpath=../.."));
    expect(panel.left).toBeGreaterThanOrEqual(16);
    expect(panel.right).toBeLessThanOrEqual(374);
    await page.getByRole("radio", { name: "Chờ kiểm tra" }).check();
    await expect(page).toHaveURL(/status=pending_review/);
    const done = page.getByRole("button", { name: "Xong" });
    await expect(done).toBeInViewport();
    expect((await box(done)).bottom).toBeLessThanOrEqual((await box(bottomNav(page))).top);
    await done.click();
    await page.getByRole("link", { name: "Bỏ lọc Trạng thái: Chờ kiểm tra" }).click();
    await expect(page).not.toHaveURL(/status=/);
  });

  await test.step("Trang Trường: nút Chép link chép link web học sinh", async () => {
    await bottomNav(page).getByRole("button", { name: "Thêm" }).click();
    await sidebar(page).getByRole("link", { name: "Trường", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Trường" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    const row = page.getByRole("row", { name: /ZZE2E THPT Học sinh/ });
    const copy = row.getByRole("button", { name: /Chép link/ });
    await copy.scrollIntoViewIfNeeded();
    await copy.click();
    await expect(page.getByRole("status").filter({ hasText: "Đã chép link" })).toHaveCount(1);
    expect(await page.evaluate(() => navigator.clipboard.readText())).toMatch(/^http:\/\/bank\.localhost:3100\/t\/e2e0a000-0000-4000-8000-000000000001$/);
    const width = await pageWidth(page);
    expect(width.scroll).toBe(width.client);
  });
});
