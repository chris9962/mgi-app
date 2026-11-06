import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "e2e23test";

async function login(page: Page, username: string, password = PASSWORD) {
  await page.goto("/login");
  await page.getByLabel("Tài khoản").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

// Đăng nhập đúng rồi đợi trang tải xong: dev server biên dịch trang lần đầu, bấm trước lúc React gắn sự kiện thì nút không phản hồi.
async function loginAs(page: Page, username: string, password = PASSWORD) {
  await login(page, username, password);
  await page.waitForURL(/\/(users|profile)$/);
  await page.waitForLoadState("networkidle");
}

// Next tự gắn một role="alert" để đọc tên trang khi chuyển trang, nên lấy thông báo lỗi trong form.
const formAlert = (page: Page) => page.locator('form [role="alert"]');

test("sai mật khẩu lần 3 và 4 thì hiện hộp nhắc, sai 5 lần thì tài khoản bị khoá 15 phút", async ({ page }) => {
  await page.goto("/login");
  await page.waitForLoadState("networkidle");
  const warn = page.getByRole("dialog", { name: "Sắp bị khoá" });
  for (let i = 1; i <= 5; i++) {
    await page.getByLabel("Tài khoản").fill("zz_e2e_lock");
    await page.getByLabel("Mật khẩu", { exact: true }).fill("sai-mat-khau");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    if (i === 3 || i === 4) {
      await expect(warn).toContainText(`Sai mật khẩu ${i} lần rồi, 5 lần sẽ bị khoá tài khoản 15 phút.`);
      await expect(warn.getByRole("button", { name: "Đã hiểu" })).toBeFocused();
      await warn.getByRole("button", { name: "Đã hiểu" }).click();
      await expect(warn).toBeHidden();
    } else {
      await expect(formAlert(page)).toContainText(i === 5 ? "khoá 15 phút" : "không đúng");
      await expect(warn).toBeHidden();
    }
  }
  await login(page, "zz_e2e_lock");
  await expect(formAlert(page)).toContainText("khoá 15 phút");
});

test("Quản trị thấy tài khoản bị khoá tạm và mở khoá được", async ({ page }) => {
  await loginAs(page, "zz_e2e_admin");
  await page.goto("/users?q=zz_e2e_lock");
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Khoá tạm")).toBeVisible();
  await page.getByRole("button", { name: "Mở khoá tài khoản E2E Khoá" }).click();
  await page.getByRole("dialog", { name: "Mở khoá tài khoản" }).getByRole("button", { name: "Mở khoá" }).click();
  await expect(page.getByText("Khoá tạm")).toHaveCount(0);
  await page.context().clearCookies();
  await login(page, "zz_e2e_lock");
  await expect(page).toHaveURL(/\/profile$/);
});

test("hộp thoại focus ô đầu tiên khi mở, trả focus về nút mở khi đóng", async ({ page }) => {
  await loginAs(page, "zz_e2e_admin");
  const opener = page.getByRole("button", { name: "Thêm tài khoản" });
  await opener.click();
  await expect(page.getByRole("dialog").getByLabel("Họ tên")).toBeFocused();
  await page.getByRole("dialog").getByRole("button", { name: "Huỷ" }).click();
  await expect(opener).toBeFocused();
});

test("menu tài khoản đóng bằng Esc và trả focus về nút mở", async ({ page }) => {
  await loginAs(page, "zz_e2e_admin");
  const trigger = page.locator('button[aria-controls="account-menu"]');
  await trigger.click();
  await expect(page.getByRole("link", { name: "Thông tin cá nhân" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("link", { name: "Thông tin cá nhân" })).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test("Nhân viên không mở được trang Tài khoản", async ({ page }) => {
  await login(page, "zz_e2e_staff");
  await expect(page).toHaveURL(/\/profile$/);
  await expect(page.getByRole("link", { name: "Tài khoản" })).toHaveCount(0);
  const res = await page.goto("/users");
  expect(res?.status()).toBe(404);
});

test("Quản trị tạo tài khoản, đặt lại mật khẩu, tài khoản mới đăng nhập bằng mật khẩu mới", async ({ page }) => {
  await loginAs(page, "zz_e2e_admin");
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
  await page.waitForLoadState("networkidle");
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

test("trình duyệt chặn clipboard thì nút Chép báo không chép được và chọn sẵn mật khẩu", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, "clipboard", { value: undefined, configurable: true }));
  await loginAs(page, "zz_e2e_admin");
  await page.getByRole("button", { name: "Thêm tài khoản" }).click();
  const form = page.getByRole("dialog", { name: "Thêm tài khoản" });
  await form.getByLabel("Họ tên").fill("E2E Chép");
  await form.getByLabel("Tên đăng nhập").fill("zz_e2e_copy");
  await form.getByRole("button", { name: "Tạo tài khoản" }).click();
  const dialog = page.getByRole("dialog", { name: "Mật khẩu mới" });
  await dialog.getByRole("button", { name: "Chép" }).click();
  await expect(dialog.getByRole("status")).toHaveText("Không chép được.");
  const password = (await dialog.locator("code").textContent())!.trim();
  expect(await page.evaluate(() => window.getSelection()?.toString().trim())).toBe(password);
});
