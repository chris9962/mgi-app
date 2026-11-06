import { expect, test, type Page } from "@playwright/test";
import { api, apiLogin, asUser, createUser, expectDialogFits, formAlert, newPage, open, PHONE } from "./edge-config-support";

const fillLogin = async (page: Page, username: string, password: string) => {
  await page.getByLabel("Tài khoản").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
};

test("đăng nhập: bỏ trống, chỉ khoảng trắng thì báo nhập, không gọi API; tên dài, ký tự lạ báo không đúng, không lỗi 500", async ({ page }) => {
  let calls = 0;
  page.on("request", (r) => {
    if (r.url().endsWith("/api/admin/login")) calls++;
  });
  await open(page, "/login");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(formAlert(page)).toHaveText("Nhập tên đăng nhập và mật khẩu.");
  await fillLogin(page, "    ", "x");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(formAlert(page)).toHaveText("Nhập tên đăng nhập và mật khẩu.");
  expect(calls).toBe(0);

  // Tên không có thật cũng bị đếm và khoá giả ở máy chủ: gắn hậu tố riêng mỗi lượt để lượt chạy sau không gặp khoá.
  const tag = Date.now().toString(36);
  const odd = [`' or 1=1 -- ${tag}`, `<script>alert(1)</script>${tag}`, `😀${tag}`, `"\\%_${tag}`, "a".repeat(300) + tag];
  for (const name of odd) {
    await fillLogin(page, name, "sai");
    await page.getByLabel("Mật khẩu", { exact: true }).press("Enter");
    await expect(formAlert(page)).toHaveText("Tên đăng nhập hoặc mật khẩu không đúng.");
    await expect(page).toHaveURL(/\/login$/);
  }
  expect(calls).toBe(odd.length);
  const res = await api(page, "POST", "/api/admin/login", { username: "x".repeat(20_000), password: "y" });
  expect(res.status).toBe(401);
});

test("đăng nhập trên điện thoại: tên viết hoa có khoảng trắng vẫn vào được; sai lần 3 tính cả cách gõ khác của cùng tên; đổi tên thì đếm lại; khoá rồi thì mật khẩu đúng vẫn bị khoá", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const { password } = await createUser(admin, { fullName: "E2E C Khoá", username: "zz_e2e_c_dn" });
  const page = await newPage(browser, PHONE);
  await open(page, "/login");
  await fillLogin(page, "  ZZ_E2E_C_DN  ", password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/profile$/);
  await page.context().clearCookies();

  await open(page, "/login");
  const warn = page.getByRole("dialog", { name: "Sắp bị khoá" });
  for (const [i, name] of ["ZZ_E2E_C_DN", " zz_e2e_c_dn ", "zz_e2e_c_dn"].entries()) {
    await fillLogin(page, name, "sai-mat-khau");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    if (i < 2) await expect(formAlert(page)).toHaveText("Tên đăng nhập hoặc mật khẩu không đúng.");
  }
  await expect(warn).toContainText("Sai mật khẩu 3 lần rồi, 5 lần sẽ bị khoá tài khoản 15 phút.");
  await expectDialogFits(page, warn);
  await warn.getByRole("button", { name: "Đã hiểu" }).click();
  await expect(warn).toBeHidden();

  await fillLogin(page, `zz_e2e_c_khac_${Date.now().toString(36)}`, "sai");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(formAlert(page)).toHaveText("Tên đăng nhập hoặc mật khẩu không đúng.");
  await expect(warn).toBeHidden();

  for (let i = 4; i <= 5; i++) {
    await fillLogin(page, "zz_e2e_c_dn", "sai-mat-khau");
    await page.getByRole("button", { name: "Đăng nhập" }).click();
    await expect(formAlert(page)).toContainText(i === 5 ? "khoá 15 phút" : "không đúng");
  }
  await fillLogin(page, "zz_e2e_c_dn", password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(formAlert(page)).toContainText("khoá 15 phút");
  const alertBox = await formAlert(page).evaluate((el) => el.getBoundingClientRect().right);
  expect(alertBox).toBeLessThanOrEqual(390);
  await expect(page).toHaveURL(/\/login$/);
});

test("đăng nhập: bấm hai lần liền chỉ gửi một lượt, nút khoá lúc chờ; mất mạng thì báo kiểm tra mạng và mở lại nút", async ({ page }) => {
  let calls = 0;
  await page.route("**/api/admin/login", async (route) => {
    calls++;
    await new Promise((r) => setTimeout(r, 800));
    await route.continue();
  });
  await open(page, "/login");
  await fillLogin(page, `zz_e2e_c_khong_co_${Date.now().toString(36)}`, "sai");
  await page.getByRole("button", { name: "Đăng nhập" }).dblclick();
  await expect(page.getByRole("button", { name: "Đang kiểm tra…" })).toBeDisabled();
  await expect(formAlert(page)).toHaveText("Tên đăng nhập hoặc mật khẩu không đúng.");
  expect(calls).toBe(1);

  await page.unroute("**/api/admin/login");
  await page.route("**/api/admin/login", (route) => route.abort("internetdisconnected"));
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(formAlert(page)).toHaveText("Không đăng nhập được. Kiểm tra kết nối mạng rồi thử lại.");
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();
});

test("đăng nhập: tài khoản bị Quản trị khoá hẳn báo không đúng như tên không có thật; người đang dùng bị khoá giữa phiên thì chuyển trang về đăng nhập, API trả 401", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const { id, password } = await createUser(admin, { fullName: "E2E C Giữa phiên", username: "zz_e2e_c_giuaphien" });
  const user = await asUser(browser, "zz_e2e_c_giuaphien", password);
  await open(user, "/profile");
  expect((await api(admin, "POST", `/api/admin/users/${id}/lock`, { active: false })).status).toBe(204);

  await user.getByRole("button", { name: "Sửa thông tin" }).click();
  await user.getByRole("dialog", { name: "Sửa thông tin" }).getByRole("button", { name: "Lưu" }).click();
  await expect(user.getByRole("dialog", { name: "Sửa thông tin" }).getByRole("alert")).toHaveText("Chưa đăng nhập hoặc phiên đã hết hạn.");
  expect((await api(user, "PATCH", "/api/admin/profile", { fullName: "x", phone: "" })).status).toBe(401);
  await user.goto("/profile");
  await expect(user).toHaveURL(/\/login$/);

  await fillLogin(user, "zz_e2e_c_giuaphien", password);
  await user.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(formAlert(user)).toHaveText("Tên đăng nhập hoặc mật khẩu không đúng.");
});

test("đăng nhập: đã đăng nhập mà mở /login thì về trang chủ; API đăng nhập, đăng xuất không có Origin hoặc Origin lạ trả 403", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await page.goto("/login");
  await expect(page).toHaveURL(/\/users$/);
  const origins: Record<string, string>[] = [{}, { Origin: "http://evil.example" }, { Origin: "http://bank.localhost:3100" }, { Origin: "not a url" }];
  for (const headers of origins) {
    expect((await api(page, "POST", "/api/admin/login", { username: "zz_e2e_admin", password: "x" }, headers)).status).toBe(403);
    expect((await api(page, "POST", "/api/admin/logout", undefined, headers)).status).toBe(403);
  }
  await page.goto("/users");
  await expect(page).toHaveURL(/\/users$/);
});

test("hai tab cùng phiên: đăng xuất ở tab 1 thì tab 2 bấm chuyển trang về đăng nhập, gọi API nhận 401", async ({ browser }) => {
  const one = await asUser(browser, "zz_e2e_admin");
  const two = await one.context().newPage();
  await open(one, "/users");
  await open(two, "/schools");
  await one.locator('button[aria-controls="account-menu"]').click();
  await one.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(one).toHaveURL(/\/login$/);
  await two.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Tài khoản" }).click();
  await expect(two).toHaveURL(/\/login$/);
  expect((await api(two, "PATCH", "/api/admin/profile", { fullName: "x", phone: "" })).status).toBe(401);
});
