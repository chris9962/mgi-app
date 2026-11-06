import { expect, test, type Page } from "@playwright/test";
import { api, asUser, createBank, createUser, newPage, open, pageScroll, PHONE, apiLogin } from "./edge-config-support";

const sidebar = (page: Page) => page.getByRole("navigation", { name: "Điều hướng chính" });
const menuHrefs = (page: Page) => sidebar(page).locator("a[href]").evaluateAll((links) => links.map((a) => a.getAttribute("href")).filter((h) => h !== "/profile"));

test("khung trang: họ tên và chức danh dài liền một chữ cắt gọn ở nút tài khoản, không tràn sidebar ở 1366 px và trong ngăn 390 px", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const longName = "Nguyễn" + "Thịdài".repeat(25);
  const { password } = await createUser(admin, { fullName: longName, username: "zz_e2e_c_tendai", title: "Chứcdanh".repeat(20) });
  const page = await asUser(browser, "zz_e2e_c_tendai", password);
  await open(page, "/profile");
  const trigger = page.locator('button[aria-controls="account-menu"]');
  await expect(trigger).toContainText(longName);
  const fits = () => sidebar(page).evaluate((nav) => ({ nav: nav.scrollWidth - nav.clientWidth, button: nav.querySelector('button[aria-controls="account-menu"]')!.getBoundingClientRect().right - nav.getBoundingClientRect().right }));
  expect((await fits()).nav).toBe(0);
  expect((await fits()).button).toBeLessThanOrEqual(0);
  const desktop = await pageScroll(page);
  expect(desktop.scroll).toBe(desktop.client);

  await page.setViewportSize(PHONE.viewport);
  await page.getByRole("navigation", { name: "Điều hướng nhanh" }).getByRole("button", { name: "Thêm" }).click();
  await expect(sidebar(page)).toBeVisible();
  expect((await fits()).nav).toBe(0);
  expect((await fits()).button).toBeLessThanOrEqual(0);
  const { scroll, client } = await pageScroll(page);
  expect(scroll).toBe(client);
});

test("khung trang: họ tên có thẻ HTML hiện nguyên văn, không chạy script; họ tên có emoji thì ô chữ tắt không có ký tự hỏng", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const html = "<img src=x onerror=window.__xss=1>";
  const a = await createUser(admin, { fullName: html, username: "zz_e2e_c_html" });
  const page = await asUser(browser, "zz_e2e_c_html", a.password);
  await open(page, "/profile");
  await expect(page.getByText(html, { exact: true }).first()).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
  expect(await page.locator("img[src=x]").count()).toBe(0);

  const b = await createUser(admin, { fullName: "Lan 😀", username: "zz_e2e_c_emoji" });
  const emoji = await asUser(browser, "zz_e2e_c_emoji", b.password);
  await open(emoji, "/profile");
  const initials = await emoji.locator('button[aria-controls="account-menu"] > span').first().textContent();
  expect(initials).toBe("L😀");
});

test("khung trang: / đưa Quản trị và Quản lý về Tài khoản, Nhân viên về Cá nhân; đường dẫn không có trang trả 404", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const m = await createUser(admin, { fullName: "E2E C Quản lý", username: "zz_e2e_c_home_ql", role: "manager" });
  await admin.goto("/");
  await expect(admin).toHaveURL(/\/users$/);
  const manager = await asUser(browser, "zz_e2e_c_home_ql", m.password);
  await manager.goto("/");
  await expect(manager).toHaveURL(/\/users$/);
  const staff = await asUser(browser, "zz_e2e_noperm");
  await staff.goto("/");
  await expect(staff).toHaveURL(/\/profile$/);
  expect((await admin.goto("/khong-co-trang-nay"))?.status()).toBe(404);
  expect((await admin.goto("/users/123/khong-co"))?.status()).toBe(404);
});

test("phân quyền: menu theo từng vai và quyền, mở thẳng URL ngoài menu trả 404", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const schools = await createUser(admin, { fullName: "E2E C Chỉ trường", username: "zz_e2e_c_menu_truong", permissions: ["schools"] });
  const banker = await createUser(admin, { fullName: "E2E C Quản ngân hàng", username: "zz_e2e_c_menu_nh" });
  await createBank(admin, "ZZCMENU", "ZZE2E Menu ngân hàng", [banker.id]);
  const manager = await createUser(admin, { fullName: "E2E C Quản lý menu", username: "zz_e2e_c_menu_ql", role: "manager" });

  const all = ["/customers", "/customer-banks", "/schools", "/banks", "/banks/codes", "/vouchers", "/users", "/sms", "/settings", "/ops"];
  const cases: [string, string | undefined, string[]][] = [
    ["zz_e2e_noperm", undefined, []],
    ["zz_e2e_c_menu_truong", schools.password, ["/schools"]],
    ["zz_e2e_c_menu_nh", banker.password, ["/customers", "/customer-banks", "/banks", "/banks/codes", "/sms"]],
    ["zz_e2e_c_menu_ql", manager.password, ["/customers", "/customer-banks", "/schools", "/banks", "/banks/codes", "/vouchers", "/users", "/sms"]],
    ["zz_e2e_admin", undefined, all],
  ];
  for (const [username, password, allowed] of cases) {
    const page = await asUser(browser, username, password);
    await open(page, "/profile");
    expect([username, await menuHrefs(page)]).toEqual([username, allowed]);
    for (const path of all.filter((p) => !allowed.includes(p))) expect([username, path, (await page.goto(path))?.status()]).toEqual([username, path, 404]);
    await page.context().close();
  }
  const noPerm = await asUser(browser, "zz_e2e_noperm");
  await open(noPerm, "/profile");
  await expect(sidebar(noPerm).getByRole("button", { expanded: true })).toHaveCount(0);
});

test("phân quyền: gỡ quyền Trường giữa phiên thì hộp thoại đang mở báo không có quyền, tải lại thì mất mục Trường và trang trả 404", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const u = await createUser(admin, { fullName: "E2E C Gỡ quyền", username: "zz_e2e_c_goquyen", permissions: ["schools"] });
  const page = await asUser(browser, "zz_e2e_c_goquyen", u.password);
  await open(page, "/schools");
  await page.getByRole("button", { name: "Thêm trường" }).click();
  const dialog = page.getByRole("dialog", { name: "Thêm trường" });
  await dialog.getByLabel("Tên trường", { exact: true }).fill("ZZE2E Gỡ quyền");
  await dialog.getByLabel("Tỉnh/thành phố").selectOption({ label: "Tỉnh Tây Ninh" });
  await dialog.getByRole("combobox", { name: "Xã/phường" }).fill("chau thanh");
  await page.getByRole("option", { name: "Xã Châu Thành" }).click();
  await dialog.getByLabel("Họ tên người liên hệ").fill("Lê Hương");
  await dialog.getByLabel("SĐT người liên hệ").fill("0903111222");

  const r = await api(admin, "PATCH", `/api/admin/users/${u.id}`, { fullName: "E2E C Gỡ quyền", staffCode: "", phone: "", username: "zz_e2e_c_goquyen", role: "staff", title: "", permissions: [] });
  expect(r.status).toBe(204);
  await dialog.getByRole("button", { name: "Tạo trường" }).click();
  await expect(dialog.getByRole("alert")).toHaveText("Không có quyền thực hiện thao tác này.");
  expect((await page.goto("/schools"))?.status()).toBe(404);
  await open(page, "/profile");
  expect(await menuHrefs(page)).toEqual([]);
});

test("menu: Kho mã chỉ đánh dấu Mã giới thiệu, Danh sách ngân hàng chỉ đánh dấu Ngân hàng của Cấu hình dữ liệu", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const current = () => sidebar(page).locator('a[aria-current="page"]').evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  await open(page, "/banks/codes");
  expect(await current()).toEqual(["/banks/codes"]);
  await open(page, "/banks");
  expect(await current()).toEqual(["/banks"]);
  await open(page, "/customer-banks");
  expect(await current()).toEqual(["/customer-banks"]);
});

test("phân quyền: Nhân viên không quyền gì thấy sidebar không có nhóm nào, thanh đáy chỉ có nút Thêm", async ({ browser }) => {
  const page = await newPage(browser, PHONE);
  await apiLogin(page, "zz_e2e_noperm");
  await open(page, "/profile");
  await page.getByRole("navigation", { name: "Điều hướng nhanh" }).getByRole("button", { name: "Thêm" }).click();
  await expect(sidebar(page).getByRole("button", { expanded: true })).toHaveCount(0);
  await expect(sidebar(page).locator('button[aria-controls="account-menu"]')).toBeVisible();
});
