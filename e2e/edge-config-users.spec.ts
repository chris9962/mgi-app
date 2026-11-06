import { expect, test, type Page } from "@playwright/test";
import { api, apiLogin, asUser, createUser, expectDialogFits, newPage, open, pageScroll, PHONE } from "./edge-config-support";

const rows = (page: Page) => page.locator("tbody tr");
const usernames = (page: Page) => page.locator("tbody tr td:first-child span.block").allTextContents();
const MISSING = "00000000-0000-4000-8000-00000000c0de";

async function searchUsers(page: Page, q: string) {
  const box = page.getByLabel("Tìm tài khoản");
  await box.fill(q);
  await box.press("Enter");
  await page.waitForLoadState("networkidle");
}

async function openAdd(page: Page) {
  await page.getByRole("button", { name: "Thêm tài khoản" }).click();
  return page.getByRole("dialog", { name: "Thêm tài khoản" });
}

test("Tài khoản: họ tên, chức danh 150 ký tự liền: bảng, trang chi tiết, hộp Khoá không làm trang cuộn ngang ở 1366 px và 390 px; họ tên có thẻ HTML hiện nguyên văn", async ({ page }) => {
  test.setTimeout(90_000);
  await apiLogin(page, "zz_e2e_admin");
  const longName = "E2EC" + "Nguyễndài".repeat(16);
  const { id } = await createUser(page, { fullName: longName, username: "zz_e2e_c_tkdai", title: "Chứcdanhdài".repeat(14) });
  const html = `<script>window.__xss=1</script>'"`;
  const h = await createUser(page, { fullName: html, username: "zz_e2e_c_tkhtml" });
  for (const viewport of [{ width: 1366, height: 768 }, PHONE.viewport]) {
    await page.setViewportSize(viewport);
    await open(page, "/users?q=zz_e2e_c_tkdai");
    await expect(rows(page)).toHaveCount(1);
    expect(await pageScroll(page).then((s) => s.scroll - s.client)).toBe(0);
    await open(page, `/users/${id}`);
    await expect(page.getByRole("heading", { level: 1 })).toContainText(longName.slice(0, 20));
    expect(await pageScroll(page).then((s) => s.scroll - s.client)).toBe(0);
    const card = page.getByRole("region", { name: "Tài khoản" }).first();
    expect(await card.evaluate((el) => el.scrollWidth - el.clientWidth)).toBeLessThanOrEqual(0);
    await page.getByRole("button", { name: "Khoá tài khoản" }).click();
    const d = page.getByRole("dialog", { name: "Khoá tài khoản" });
    await expectDialogFits(page, d);
    await d.getByRole("button", { name: "Huỷ" }).click();
  }
  await open(page, `/users/${h.id}`);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(html);
  await page.getByRole("button", { name: "Sửa" }).click();
  await expect(page.getByRole("dialog", { name: "Sửa tài khoản" }).getByLabel("Họ tên")).toHaveValue(html);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();
});

test("Tài khoản: tìm không dấu, viết hoa, một phần tên đăng nhập; % và _ là chữ thường; chỉ khoảng trắng như không tìm; không khớp ghi câu báo", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await createUser(page, { fullName: "E2E C Tìm Phần Trăm 50%", username: "zz_e2e_c_tim1" });
  await createUser(page, { fullName: "E2E C Tìm Năm Trăm 500", username: "zz_e2e_c_tim2" });
  await createUser(page, { fullName: "E2E C Gạch", username: "zz_e2e_c_ta_b" });
  await createUser(page, { fullName: "E2E C Không gạch", username: "zz_e2e_c_taxb" });
  await open(page, "/users");
  for (const [q, expected] of [
    ["50%", ["zz_e2e_c_tim1"]],
    ["e2e c tim", ["zz_e2e_c_tim2", "zz_e2e_c_tim1"]],
    ["TÌM PHẦN", ["zz_e2e_c_tim1"]],
    ["c_ta_b", ["zz_e2e_c_ta_b"]],
    ["   c_ta_b   ", ["zz_e2e_c_ta_b"]],
  ] as const) {
    await searchUsers(page, q);
    expect([q, (await usernames(page)).sort()]).toEqual([q, [...expected].sort()]);
  }
  await searchUsers(page, "zz_e2e_c_khong_co_ai");
  await expect(rows(page)).toHaveText(["Không có tài khoản khớp từ khoá."]);
  await searchUsers(page, "    ");
  expect(await rows(page).count()).toBeGreaterThan(4);
});

test("Tài khoản: 16 tài khoản khớp chia 15 và 1; page lạ, q lặp không lỗi 500; /users/abc, uuid lạ trả 404", async ({ page }) => {
  test.setTimeout(90_000);
  await apiLogin(page, "zz_e2e_admin");
  for (let i = 1; i <= 16; i++) await createUser(page, { fullName: `E2E C Trang ${String(i).padStart(2, "0")}`, username: `zz_e2e_c_trang${i}` });
  await open(page, "/users?q=E2E+C+Trang");
  await expect(rows(page)).toHaveCount(15);
  const pager = page.getByRole("navigation", { name: "Phân trang" });
  await expect(pager).toContainText("1–15 trên 16");
  await pager.getByRole("link", { name: "Sau" }).click();
  await expect(rows(page)).toHaveCount(1);
  await expect(page.getByLabel("Tìm tài khoản")).toHaveValue("E2E C Trang");
  for (const p of ["0", "-1", "abc", "1.5", "1e9", "999", ""]) {
    expect([p, (await page.goto(`/users?q=E2E+C+Trang&page=${p}`))?.status()]).toEqual([p, 200]);
    await expect(pager).toContainText(p === "999" || p === "1e9" ? "16–16 trên 16" : "1–15 trên 16");
  }
  expect((await page.goto("/users?q=E2E+C+Trang&q=khac&page=1&page=2"))?.status()).toBe(200);
  for (const path of ["/users/abc", `/users/${MISSING}`, "/users/%27%20or%201%3D1"]) expect([path, (await page.goto(path))?.status()]).toEqual([path, 404]);
});

test("Tài khoản: form báo lỗi đúng ô; tên đăng nhập viết HOA lưu thành thường; SĐT có dấu cách lưu thành 10 số; trùng tên đăng nhập khác hoa thường, trùng mã tài khoản báo ở ô; Huỷ rồi mở lại thì form trống", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  await createUser(page, { fullName: "E2E C Có mã", username: "zz_e2e_c_coma", staffCode: "ZZE2EC01" });
  await open(page, "/users");
  let d = await openAdd(page);
  const submit = () => d.getByRole("button", { name: "Tạo tài khoản" }).click();
  await d.getByLabel("Họ tên").fill("   ");
  await submit();
  await expect(d.getByLabel("Họ tên")).toHaveAccessibleDescription("Nhập họ tên");
  await d.getByLabel("Họ tên").fill("E2E C Form");
  const username = d.getByLabel("Tên đăng nhập");
  for (const bad of ["zz e2e c", "zz_e2e_đ", "ab", "z".repeat(33), "zz-e2e", "   "]) {
    await username.fill(bad);
    await submit();
    await expect(username, bad).toHaveAccessibleDescription("Tên đăng nhập 3 tới 32 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới");
  }
  await username.fill("ZZ_E2E_COMA".replace("COMA", "C_COMA"));
  await d.getByLabel("Số điện thoại").fill("12345");
  await submit();
  await expect(d.getByLabel("Số điện thoại")).toHaveAccessibleDescription("Số điện thoại gồm 10 số, bắt đầu bằng 0");
  await d.getByLabel("Số điện thoại").fill("0903 111 444");
  await submit();
  await expect(username).toHaveAccessibleDescription("Tên đăng nhập đã có.");
  await username.fill("  ZZ_E2E_C_HOA  ");
  await d.getByLabel("Mã tài khoản").fill("ZZE2EC01");
  await submit();
  await expect(d.getByLabel("Mã tài khoản")).toHaveAccessibleDescription("Mã tài khoản đã có.");
  await d.getByLabel("Mã tài khoản").fill("");
  await submit();
  const created = page.getByRole("dialog", { name: "Mật khẩu mới" });
  await expect(created).toBeVisible();
  await created.getByRole("button", { name: "Đóng", exact: true }).last().click();
  await open(page, "/users?q=zz_e2e_c_hoa");
  expect(await usernames(page)).toEqual(["zz_e2e_c_hoa"]);
  await page.getByRole("link", { name: "E2E C Form" }).click();
  await expect(page.getByText("0903111444", { exact: true })).toBeVisible();

  await open(page, "/users");
  d = await openAdd(page);
  await d.getByLabel("Họ tên").fill("Gõ dở");
  await d.getByLabel("Tên đăng nhập").fill("go_do");
  await d.getByLabel("Quản lý ngân hàng").check();
  await d.getByRole("button", { name: "Huỷ" }).click();
  d = await openAdd(page);
  await expect(d.getByLabel("Họ tên")).toHaveValue("");
  await expect(d.getByLabel("Tên đăng nhập")).toHaveValue("");
  await expect(d.getByLabel("Quản lý ngân hàng")).not.toBeChecked();
});

test("Tài khoản: ba request tạo cùng tên đăng nhập cùng lúc thì một 201, hai 409; bấm Tạo hai lần liền chỉ tạo một; bấm Esc lúc đang chờ thì hộp không đóng, mật khẩu mới vẫn hiện", async ({ page }) => {
  await apiLogin(page, "zz_e2e_admin");
  const body = { fullName: "E2E C Đồng thời", username: "zz_e2e_c_dongthoi", staffCode: "", phone: "", title: "", role: "staff", permissions: [] };
  const results = await Promise.all([1, 2, 3].map(() => api(page, "POST", "/api/admin/users", body)));
  expect(results.map((r) => r.status).sort()).toEqual([201, 409, 409]);
  for (const r of results.filter((x) => x.status !== 201)) expect(r.body).toEqual({ message: "Tên đăng nhập đã có.", field: "username" });

  let posts = 0;
  await page.route("**/api/admin/users", async (route) => {
    if (route.request().method() === "POST") posts++;
    await new Promise((r) => setTimeout(r, 900));
    await route.continue();
  });
  await open(page, "/users");
  let d = await openAdd(page);
  await d.getByLabel("Họ tên").fill("E2E C Bấm hai lần");
  await d.getByLabel("Tên đăng nhập").fill("zz_e2e_c_haILan");
  await d.getByRole("button", { name: "Tạo tài khoản" }).dblclick();
  await expect(page.getByRole("dialog", { name: "Mật khẩu mới" })).toBeVisible();
  expect(posts).toBe(1);
  await page.getByRole("dialog", { name: "Mật khẩu mới" }).getByRole("button", { name: "Đóng", exact: true }).last().click();

  d = await openAdd(page);
  await d.getByLabel("Họ tên").fill("E2E C Esc");
  await d.getByLabel("Tên đăng nhập").fill("zz_e2e_c_esc");
  await d.getByRole("button", { name: "Tạo tài khoản" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Mật khẩu mới" })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Mật khẩu mới" }).locator("code")).toHaveText(/\S{6,}/);
});

test("Tài khoản: đổi Nhân viên có quyền sang Quản lý thì ô quyền ẩn, trang chi tiết ghi Toàn quyền; Quản trị tự đổi vai của mình báo ở ô Vai", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const u = await createUser(admin, { fullName: "E2E C Lên Quản lý", username: "zz_e2e_c_lenql", permissions: ["schools", "vouchers"] });
  await open(admin, `/users/${u.id}`);
  await admin.getByRole("button", { name: "Sửa" }).click();
  const d = admin.getByRole("dialog", { name: "Sửa tài khoản" });
  await expect(d.getByLabel("Trường và QR")).toBeChecked();
  await d.getByLabel("Vai").selectOption("manager");
  await expect(d.getByRole("group", { name: "Quyền" })).toHaveCount(0);
  await d.getByRole("button", { name: "Lưu" }).click();
  await expect(d).toBeHidden();
  await expect(admin.getByRole("region", { name: "Quyền" })).toContainText("Toàn quyền");

  const qt = await createUser(admin, { fullName: "E2E C Quản trị tự đổi", username: "zz_e2e_c_qt", role: "admin" });
  const self = await asUser(browser, "zz_e2e_c_qt", qt.password);
  await open(self, `/users/${qt.id}`);
  await self.getByRole("button", { name: "Sửa" }).click();
  const sd = self.getByRole("dialog", { name: "Sửa tài khoản" });
  await sd.getByLabel("Vai").selectOption("manager");
  await sd.getByRole("button", { name: "Lưu" }).click();
  await expect(sd.locator('[id$="-error"]')).toHaveText(["Không tự đổi vai của chính mình."]);
});

test("Tài khoản: Quản lý không thấy nút sửa, khoá ở dòng Quản trị, ô Vai không có Quản trị; API sửa, khoá, đặt lại mật khẩu của Quản trị trả 403; Nhân viên gọi API tài khoản trả 403", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const qt = await createUser(admin, { fullName: "E2E C Quản trị đích", username: "zz_e2e_c_qtdich", role: "admin" });
  const ql = await createUser(admin, { fullName: "E2E C Quản lý thử", username: "zz_e2e_c_qlthu", role: "manager" });
  const manager = await asUser(browser, "zz_e2e_c_qlthu", ql.password);
  await open(manager, "/users?q=zz_e2e_c_qtdich");
  await expect(rows(manager)).toHaveCount(1);
  await expect(rows(manager).first().getByRole("button")).toHaveCount(0);
  await open(manager, `/users/${qt.id}`);
  await expect(manager.getByRole("button", { name: "Sửa" })).toHaveCount(0);
  await open(manager, "/users");
  const d = await openAdd(manager);
  await expect(d.getByLabel("Vai").locator("option")).toHaveText(["Quản lý", "Nhân viên"]);

  const edit = { fullName: "x", username: "zz_e2e_c_qtdich", staffCode: "", phone: "", title: "", role: "admin", permissions: [] };
  expect((await api(manager, "PATCH", `/api/admin/users/${qt.id}`, edit)).status).toBe(403);
  expect((await api(manager, "POST", `/api/admin/users/${qt.id}/lock`, { active: false })).status).toBe(403);
  expect((await api(manager, "POST", `/api/admin/users/${qt.id}/reset-password`)).status).toBe(403);
  expect((await api(manager, "POST", "/api/admin/users", { ...edit, username: "zz_e2e_c_qtmoi" })).status).toBe(403);
  expect((await api(manager, "PATCH", `/api/admin/users/${MISSING}`, { ...edit, role: "staff" })).status).toBe(404);

  const staff = await asUser(browser, "zz_e2e_noperm");
  expect((await api(staff, "GET", "/api/admin/users/options?q=a")).status).toBe(403);
  expect((await api(staff, "POST", "/api/admin/users", { ...edit, role: "staff", username: "zz_e2e_c_lan" })).status).toBe(403);
  expect((await api(staff, "POST", `/api/admin/users/${ql.id}/lock`, { active: false })).status).toBe(403);
});

test("Tài khoản: trang của chính mình không có nút Khoá và Đặt lại mật khẩu; API đặt lại mật khẩu của chính mình bị từ chối, phiên vẫn còn", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const qt = await createUser(admin, { fullName: "E2E C Tự đặt lại", username: "zz_e2e_c_tudat", role: "admin" });
  const self = await asUser(browser, "zz_e2e_c_tudat", qt.password);
  await open(self, `/users/${qt.id}`);
  await expect(self.getByRole("button", { name: "Sửa" })).toBeVisible();
  await expect(self.getByRole("button", { name: /Khoá tài khoản/ })).toHaveCount(0);
  await expect(self.getByRole("button", { name: "Đặt lại mật khẩu" })).toHaveCount(0);
  const r = await api(self, "POST", `/api/admin/users/${qt.id}/reset-password`);
  expect(r.status).toBe(400);
  expect((await api(self, "POST", `/api/admin/users/${qt.id}/lock`, { active: false })).status).toBe(400);
  expect((await self.goto("/users"))?.status()).toBe(200);
  await expect(self).toHaveURL(/\/users$/);
});

test("Tài khoản: đặt lại mật khẩu thì mật khẩu cũ hỏng, phiên cũ bị đăng xuất, mật khẩu mới đăng nhập được; tab 2 bấm Khoá sau khi tab 1 đã khoá thì không lỗi", async ({ browser }) => {
  const admin = await asUser(browser, "zz_e2e_admin");
  const u = await createUser(admin, { fullName: "E2E C Đặt lại", username: "zz_e2e_c_datlai" });
  const user = await asUser(browser, "zz_e2e_c_datlai", u.password);
  await open(admin, `/users/${u.id}`);
  await admin.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  await admin.getByRole("dialog", { name: "Đặt lại mật khẩu" }).getByRole("button", { name: "Đặt lại" }).click();
  const shown = admin.getByRole("dialog", { name: "Mật khẩu mới" });
  const fresh = (await shown.locator("code").textContent())!.trim();
  expect(fresh).not.toBe(u.password);
  expect((await api(user, "PATCH", "/api/admin/profile", { fullName: "x", phone: "" })).status).toBe(401);
  const again = await newPage(browser);
  expect((await api(again, "POST", "/api/admin/login", { username: "zz_e2e_c_datlai", password: u.password })).status).toBe(401);
  await apiLogin(again, "zz_e2e_c_datlai", fresh);
  await shown.getByRole("button", { name: "Đóng", exact: true }).last().click();

  const two = await admin.context().newPage();
  await open(admin, `/users/${u.id}`);
  await open(two, `/users/${u.id}`);
  for (const page of [admin, two]) {
    await page.getByRole("button", { name: "Khoá tài khoản" }).click();
    await page.getByRole("dialog", { name: "Khoá tài khoản" }).getByRole("button", { name: "Khoá", exact: true }).click();
    await expect(page.getByRole("dialog", { name: "Khoá tài khoản" })).toBeHidden();
    await expect(page.getByRole("button", { name: "Mở khoá tài khoản" })).toBeVisible();
  }
  expect((await api(again, "PATCH", "/api/admin/profile", { fullName: "x", phone: "" })).status).toBe(401);
});
