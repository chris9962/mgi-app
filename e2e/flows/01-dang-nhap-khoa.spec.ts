import type { Page } from "@playwright/test";
import { ADMIN, chapter, expect, login, loginAs, logout, openMenu, test } from "./support";

// Next tự gắn một role="alert" để đọc tên trang khi chuyển trang, nên lấy thông báo lỗi trong form.
const formAlert = (page: Page) => page.locator('form [role="alert"]');

test("Flow 1: đăng nhập, khoá sau 5 lần sai, Quản trị mở khoá", async ({ page }) => {
  await test.step("Nhân viên gõ sai mật khẩu 5 lần, lần 3 và 4 hiện hộp nhắc", async () => {
    await page.goto(`${ADMIN}/login`);
    await page.waitForLoadState("networkidle");
    const warn = page.getByRole("dialog", { name: "Sắp bị khoá" });
    for (let i = 1; i <= 5; i++) {
      await page.getByLabel("Tài khoản").fill("zz_e2e_lock");
      await page.getByLabel("Mật khẩu", { exact: true }).fill(`sai-lan-${i}`);
      await page.getByRole("button", { name: "Đăng nhập" }).click();
      if (i === 3 || i === 4) {
        await expect(warn).toContainText(`Sai mật khẩu ${i} lần rồi`);
        await warn.getByRole("button", { name: "Đã hiểu" }).click();
        await expect(warn).toBeHidden();
      } else await expect(formAlert(page)).toBeVisible();
    }
    await expect(formAlert(page)).toContainText("khoá 15 phút");
  });

  await test.step("Đúng mật khẩu vẫn bị chặn trong 15 phút", async () => {
    await login(page, "zz_e2e_lock");
    await expect(formAlert(page)).toContainText("khoá 15 phút");
    await expect(page).toHaveURL(/\/login$/);
  });

  await test.step("Quản trị đăng nhập, thấy tài khoản Khoá tạm", async () => {
    await chapter(page, "Quản trị mở khoá");
    await loginAs(page, "zz_e2e_admin");
    await openMenu(page, "Tài khoản");
    const box = page.getByLabel("Tìm tài khoản");
    await box.fill("zz_e2e_lock");
    await box.press("Enter");
    await page.waitForURL(/q=zz_e2e_lock/);
    await expect(page.getByRole("row", { name: /E2E Khoá/ }).getByText("Khoá tạm")).toBeVisible();
  });

  await test.step("Quản trị bấm Mở khoá", async () => {
    await page.getByRole("button", { name: "Mở khoá tài khoản E2E Khoá" }).click();
    await page.getByRole("dialog", { name: "Mở khoá tài khoản" }).getByRole("button", { name: "Mở khoá" }).click();
    await expect(page.getByText("Khoá tạm")).toHaveCount(0);
    await logout(page);
  });

  await test.step("Nhân viên đăng nhập lại được", async () => {
    await chapter(page, "Nhân viên đăng nhập lại");
    await login(page, "zz_e2e_lock");
    await expect(page).toHaveURL(/\/profile$/);
    await expect(page.getByRole("heading", { level: 1, name: "Cá nhân" })).toBeVisible();
  });
});
