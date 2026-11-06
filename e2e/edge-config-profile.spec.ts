import { expect, test } from "@playwright/test";
import { api, asUser, createUser, newPage, open, pageScroll, PHONE } from "./edge-config-support";

test("Cá nhân: họ tên 150 ký tự liền xuống hàng trong khung, không bị cắt ở 390 px; họ tên có thẻ HTML hiện nguyên văn; SĐT trống ghi Chưa có", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const longName = "E2EC" + "Nguyễndài".repeat(16);
  const a = await createUser(admin, { fullName: longName, username: "zz_e2e_c_cndai" });
  const page = await asUser(browser, "zz_e2e_c_cndai", a.password, PHONE);
  await open(page, "/profile");
  const value = page.locator("main b").first();
  await expect(value).toHaveText(longName);
  const fits = await value.evaluate((el) => {
    const group = el.closest("section")!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    return { right: r.right - group.right, hidden: el.scrollWidth - el.clientWidth };
  });
  expect(fits.right).toBeLessThanOrEqual(0);
  expect(fits.hidden).toBeLessThanOrEqual(0);
  const { scroll, client } = await pageScroll(page);
  expect(scroll).toBe(client);
  await expect(page.getByText("Chưa có", { exact: true })).toBeVisible();

  const h = await createUser(admin, { fullName: "<b>x</b>", username: "zz_e2e_c_cnhtml" });
  const html = await asUser(browser, "zz_e2e_c_cnhtml", h.password);
  await open(html, "/profile");
  await expect(html.locator("main b").first()).toHaveText("<b>x</b>");
});

test("Cá nhân: Sửa thông tin báo lỗi đúng ô; SĐT có dấu cách lưu thành 10 số; mất mạng báo kiểm tra mạng; Huỷ rồi mở lại thì không còn lỗi cũ ở cả hai hộp", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const u = await createUser(admin, { fullName: "E2E C Cá nhân form", username: "zz_e2e_c_cnform" });
  const page = await asUser(browser, "zz_e2e_c_cnform", u.password);
  await open(page, "/profile");
  await page.getByRole("button", { name: "Sửa thông tin" }).click();
  const d = page.getByRole("dialog", { name: "Sửa thông tin" });
  await d.getByLabel("Họ tên").fill("   ");
  await d.getByLabel("Số điện thoại").fill("0903");
  await d.getByRole("button", { name: "Lưu" }).click();
  await expect(d.getByLabel("Họ tên")).toHaveAccessibleDescription("Nhập họ tên");
  await expect(d.getByLabel("Số điện thoại")).toHaveAccessibleDescription("Số điện thoại gồm 10 số, bắt đầu bằng 0");
  await d.getByRole("button", { name: "Huỷ" }).click();
  await page.getByRole("button", { name: "Sửa thông tin" }).click();
  await expect(d.locator('[id$="-error"]')).toHaveCount(0);

  await page.route("**/api/admin/profile", (route) => route.abort("internetdisconnected"));
  await d.getByLabel("Số điện thoại").fill("0903 222 333");
  await d.getByRole("button", { name: "Lưu" }).click();
  await expect(d.getByRole("alert")).toHaveText("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
  await d.getByRole("button", { name: "Huỷ" }).click();
  await page.unroute("**/api/admin/profile");
  await page.getByRole("button", { name: "Sửa thông tin" }).click();
  await expect(d.getByRole("alert")).toHaveCount(0);
  await d.getByLabel("Số điện thoại").fill("0903 222 333");
  await d.getByRole("button", { name: "Lưu" }).click();
  await expect(d).toBeHidden();
  await expect(page.getByText("0903222333", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  const p = page.getByRole("dialog", { name: "Đổi mật khẩu" });
  await p.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(p.getByLabel("Mật khẩu hiện tại")).toHaveAccessibleDescription("Nhập mật khẩu hiện tại");
  await p.getByLabel("Mật khẩu hiện tại").fill("x");
  await p.getByLabel("Mật khẩu mới", { exact: true }).fill("abc");
  await p.getByLabel("Nhập lại mật khẩu mới").fill("abd");
  await p.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(p.getByLabel("Nhập lại mật khẩu mới")).toHaveAccessibleDescription("Hai lần nhập không giống nhau");
  await p.getByRole("button", { name: "Huỷ" }).click();
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(p.locator('[id$="-error"]')).toHaveCount(0);
});

test("Cá nhân: sai mật khẩu hiện tại báo ở ô, sai 5 lần thì báo khoá 15 phút và đăng nhập lại cũng bị khoá", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const u = await createUser(admin, { fullName: "E2E C Sai mật khẩu", username: "zz_e2e_c_cnsai" });
  const page = await asUser(browser, "zz_e2e_c_cnsai", u.password);
  await open(page, "/profile");
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  const p = page.getByRole("dialog", { name: "Đổi mật khẩu" });
  await p.getByLabel("Mật khẩu mới", { exact: true }).fill("moi-moi");
  await p.getByLabel("Nhập lại mật khẩu mới").fill("moi-moi");
  const wrongCurrent = async (i: number) => {
    await p.getByLabel("Mật khẩu hiện tại").fill(`sai-${i}`);
    await p.getByRole("button", { name: "Đổi mật khẩu" }).click();
  };
  for (let i = 1; i <= 4; i++) {
    await wrongCurrent(i);
    await expect(p.getByLabel("Mật khẩu hiện tại"), String(i)).toHaveAccessibleDescription("Mật khẩu hiện tại không đúng.");
  }
  await wrongCurrent(5);
  await expect(p.getByRole("alert")).toContainText("khoá 15 phút");
  const other = await newPage(browser);
  expect((await api(other, "POST", "/api/admin/login", { username: "zz_e2e_c_cnsai", password: u.password })).body).toMatchObject({ message: expect.stringContaining("khoá 15 phút") });
});

test("Cá nhân: đổi mật khẩu thì phiên đang dùng còn, phiên ở trình duyệt khác bị đăng xuất, mật khẩu cũ hỏng, mật khẩu mới có dấu cách đầu cuối đăng nhập đúng nguyên văn", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const u = await createUser(admin, { fullName: "E2E C Đổi MK", username: "zz_e2e_c_cndoi" });
  const page = await asUser(browser, "zz_e2e_c_cndoi", u.password);
  const other = await asUser(browser, "zz_e2e_c_cndoi", u.password);
  await open(page, "/profile");
  await page.getByRole("button", { name: "Đổi mật khẩu" }).click();
  const p = page.getByRole("dialog", { name: "Đổi mật khẩu" });
  const fresh = "  mật khẩu mới  ";
  await p.getByLabel("Mật khẩu hiện tại").fill(u.password);
  await p.getByLabel("Mật khẩu mới", { exact: true }).fill(fresh);
  await p.getByLabel("Nhập lại mật khẩu mới").fill(fresh);
  await p.getByRole("button", { name: "Đổi mật khẩu" }).click();
  await expect(p).toBeHidden();
  await expect(page.getByText("Đã đổi", { exact: true })).toBeVisible();
  expect((await api(page, "PATCH", "/api/admin/profile", { fullName: "E2E C Đổi MK", phone: "" })).status).toBe(204);
  expect((await api(other, "PATCH", "/api/admin/profile", { fullName: "x", phone: "" })).status).toBe(401);
  const login = await newPage(browser);
  for (const [password, status] of [
    [u.password, 401],
    ["mật khẩu mới", 401],
    [fresh, 204],
  ] as const) {
    expect([password, (await api(login, "POST", "/api/admin/login", { username: "zz_e2e_c_cndoi", password })).status]).toEqual([password, status]);
  }
});

test("Cá nhân: API sửa thông tin, đổi mật khẩu không có Origin hoặc Origin lạ trả 403; không có phiên trả 401", async ({ browser }) => {
  const page = await asUser(browser, "zz_e2e_noperm");
  for (const headers of [{}, { Origin: "http://evil.example" }] as Record<string, string>[]) {
    expect((await api(page, "PATCH", "/api/admin/profile", { fullName: "x", phone: "" }, headers)).status).toBe(403);
    expect((await api(page, "POST", "/api/admin/profile/password", { currentPassword: "a", newPassword: "b", confirmPassword: "b" }, headers)).status).toBe(403);
  }
  const anon = await newPage(browser);
  expect((await api(anon, "PATCH", "/api/admin/profile", { fullName: "x", phone: "" })).status).toBe(401);
  expect((await api(anon, "POST", "/api/admin/profile/password", { currentPassword: "a", newPassword: "b", confirmPassword: "b" })).status).toBe(401);
});
