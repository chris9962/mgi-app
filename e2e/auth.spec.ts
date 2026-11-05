import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "e2e23test";

async function login(page: Page, username: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Tài khoản").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

// Next tự gắn một role="alert" để đọc tên trang khi chuyển trang, nên lấy thông báo lỗi trong form.
const formAlert = (page: Page) => page.locator('form [role="alert"]');

test("sai mật khẩu 5 lần thì tài khoản bị khoá 15 phút", async ({ page }) => {
  for (let i = 0; i < 5; i++) {
    await login(page, "zz_e2e_lock", "sai-mat-khau");
    await expect(formAlert(page)).toBeVisible();
  }
  await expect(formAlert(page)).toContainText("khoá 15 phút");
  await login(page, "zz_e2e_lock");
  await expect(formAlert(page)).toContainText("khoá 15 phút");
});

test("Nhân viên không mở được trang Tài khoản", async ({ page }) => {
  await login(page, "zz_e2e_staff");
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("link", { name: "Tài khoản" })).toHaveCount(0);
  const res = await page.goto("/users");
  expect(res?.status()).toBe(404);
});

test("Quản trị tạo tài khoản, đặt lại mật khẩu, tài khoản mới đăng nhập bằng mật khẩu mới", async ({ page }) => {
  await login(page, "zz_e2e_admin");
  await expect(page).toHaveURL(/\/users$/);
  await page.getByRole("button", { name: "Thêm tài khoản" }).click();
  const form = page.getByRole("dialog", { name: "Thêm tài khoản" });
  await form.getByLabel("Họ tên").fill("E2E Mới");
  await form.getByLabel("Tên đăng nhập").fill("zz_e2e_new");
  await form.getByLabel("Trường và QR").check();
  await form.getByRole("button", { name: "Tạo tài khoản" }).click();
  await expect(page.getByRole("dialog", { name: "Mật khẩu mới" })).toBeVisible();
  await page.getByRole("button", { name: "Đóng" }).last().click();

  await page.getByRole("link", { name: "E2E Mới" }).click();
  await expect(page.getByRole("heading", { name: "E2E Mới" })).toBeVisible();
  await page.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  await page.getByRole("dialog", { name: "Đặt lại mật khẩu" }).getByRole("button", { name: "Đặt lại" }).click();
  const code = page.getByRole("dialog", { name: "Mật khẩu mới" }).locator("code");
  const newPassword = (await code.textContent())!.trim();
  expect(newPassword).toMatch(/^[a-z2-9]{10}$/);

  await page.context().clearCookies();
  await login(page, "zz_e2e_new", newPassword);
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByText("Trường và QR")).toHaveCount(0);
});
