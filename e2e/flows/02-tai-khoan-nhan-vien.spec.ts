import { chapter, expect, login, loginAs, logout, openMenu, sidebar, test } from "./support";
import { openSidebarGroups } from "../sidebar-groups";

const NAME = "E2E Trần Thu Ngân";
const USERNAME = "zz_e2e_thungan";
const NEW_PASSWORD = "ngan2026moi";

test("Flow 2: Quản trị tạo tài khoản Nhân viên, cấp quyền, đặt lại mật khẩu; Nhân viên đổi mật khẩu", async ({ page }) => {
  let resetPassword = "";

  await test.step("Quản trị tạo tài khoản Nhân viên có quyền Trường và QR, Xuất Excel", async () => {
    await loginAs(page, "zz_e2e_admin");
    await page.getByRole("button", { name: "Thêm tài khoản" }).click();
    const form = page.getByRole("dialog", { name: "Thêm tài khoản" });
    await form.getByLabel("Họ tên").fill(NAME);
    await form.getByLabel("Số điện thoại").fill("0905123456");
    await form.getByLabel("Tên đăng nhập").fill(USERNAME);
    await expect(form.getByLabel("Vai")).toHaveValue("staff");
    await form.getByLabel("Trường và QR").check();
    await form.getByLabel("Xuất Excel").check();
    await form.getByRole("button", { name: "Tạo tài khoản" }).click();
    const created = page.getByRole("dialog", { name: "Mật khẩu mới" });
    await expect(created.locator("code")).toHaveText(/^[a-z2-9]{10}$/);
    await created.getByRole("button", { name: "Đóng" }).last().click();
    await expect(page.getByRole("row", { name: new RegExp(NAME) })).toContainText("Trường và QR");
  });

  await test.step("Quản trị mở tài khoản, đặt lại mật khẩu", async () => {
    await page.getByRole("link", { name: NAME }).click();
    await expect(page.getByRole("heading", { level: 1, name: NAME })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("region", { name: "Quyền" })).toContainText("Xuất Excel");
    await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
    await page.getByRole("dialog", { name: "Đặt lại mật khẩu" }).getByRole("button", { name: "Đặt lại" }).click();
    const dialog = page.getByRole("dialog", { name: "Mật khẩu mới" });
    resetPassword = (await dialog.locator("code").textContent())!.trim();
    expect(resetPassword).toMatch(/^[a-z2-9]{10}$/);
    await dialog.getByRole("button", { name: "Đóng" }).last().click();
    await logout(page);
  });

  await test.step("Nhân viên đăng nhập bằng mật khẩu vừa đặt lại, thấy mục Trường", async () => {
    await chapter(page, "Nhân viên mới đăng nhập");
    await loginAs(page, USERNAME, resetPassword);
    await expect(page).toHaveURL(/\/profile$/);
    await openSidebarGroups(page);
    await expect(sidebar(page).getByRole("link", { name: "Trường", exact: true })).toBeVisible();
    await expect(sidebar(page).getByRole("link", { name: "Tài khoản", exact: true })).toHaveCount(0);
  });

  await test.step("Nhân viên đổi mật khẩu ở trang Cá nhân", async () => {
    await openMenu(page, "Trường");
    await page.locator('button[aria-controls="account-menu"]').click();
    await page.getByRole("link", { name: "Thông tin cá nhân" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Cá nhân" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
    const form = page.getByRole("dialog", { name: "Đổi mật khẩu" });
    await form.getByLabel("Mật khẩu hiện tại").fill(resetPassword);
    await form.getByLabel("Mật khẩu mới", { exact: true }).fill(NEW_PASSWORD);
    await form.getByLabel("Nhập lại mật khẩu mới").fill(NEW_PASSWORD);
    await form.getByRole("button", { name: "Đổi mật khẩu" }).click();
    await expect(page.getByRole("button", { name: /Đổi mật khẩu\s*Đã đổi/ })).toBeVisible();
    await logout(page);
  });

  await test.step("Mật khẩu cũ không dùng được, mật khẩu mới đăng nhập được", async () => {
    await login(page, USERNAME, resetPassword);
    await expect(page.locator('form [role="alert"]')).toBeVisible();
    await loginAs(page, USERNAME, NEW_PASSWORD);
    await expect(page).toHaveURL(/\/profile$/);
  });
});
