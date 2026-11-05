import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "e2e23test";

async function loginAs(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Tài khoản").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/(users|profile|schools|banks)/);
  await page.waitForLoadState("networkidle");
}

test("Quản trị tạo trường, ngân hàng có 2 khung ảnh, mã gắn cho trường", async ({ page }) => {
  await loginAs(page, "zz_e2e_admin");

  await page.goto("/schools");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Thêm trường" }).click();
  const school = page.getByRole("dialog", { name: "Thêm trường" });
  await school.getByLabel("Tên trường", { exact: true }).fill("ZZE2E THPT Nguyễn Du");
  await school.getByLabel("Tỉnh/thành phố").selectOption({ label: "Tỉnh Tây Ninh" });
  await school.getByRole("combobox", { name: "Xã/phường" }).fill("chau thanh");
  await page.getByRole("option", { name: "Xã Châu Thành" }).click();
  await school.getByLabel("Họ tên người liên hệ").fill("Lê Thu Hương");
  await school.getByLabel("SĐT người liên hệ").fill("0903111222");
  await school.getByRole("button", { name: "Tạo trường" }).click();
  await expect(page.getByRole("cell", { name: "ZZE2E THPT Nguyễn Du", exact: true })).toBeVisible();

  await page.goto("/banks");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Thêm ngân hàng" }).click();
  const bank = page.getByRole("dialog", { name: "Thêm ngân hàng" });
  await bank.getByLabel("Mã ngân hàng").fill("ZZE2E");
  await bank.getByLabel("Độ ưu tiên").fill("1");
  await bank.getByLabel("Tên ngân hàng").fill("ZZE2E VPBank");
  await bank.getByRole("button", { name: "Tạo ngân hàng" }).click();
  await expect(page.getByRole("cell", { name: "ZZE2E VPBank", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Hướng dẫn mở tài khoản ZZE2E VPBank" }).click();
  const guide = page.getByRole("dialog", { name: /Hướng dẫn mở tài khoản/ });
  await guide.getByLabel("Các bước").fill("Tải app\nMở tài khoản");
  await guide.getByLabel("Tên ảnh 1").fill("Ảnh màn hình chính");
  await guide.getByRole("button", { name: "Thêm ảnh" }).click();
  await guide.getByLabel("Tên ảnh 2").fill("Ảnh chuyển khoản");
  await guide.getByRole("button", { name: "Lưu" }).click();
  await expect(page.getByRole("row", { name: /ZZE2E VPBank/ }).getByText("2 ảnh")).toBeVisible();

  await page.goto("/banks/codes");
  await page.waitForLoadState("networkidle");
  await page.getByRole("button", { name: "Thêm mã" }).click();
  const code = page.getByRole("dialog", { name: "Thêm mã giới thiệu" });
  await code.getByLabel("Ngân hàng").selectOption({ label: "ZZE2E VPBank" });
  await code.getByLabel("Tên hiển thị").fill("ZZE2E VPB Nguyễn Du");
  await code.getByLabel("Mã text (Mã giới thiệu)").fill("ND-E2E-01");
  await code.getByRole("combobox", { name: "Trường dùng mã này" }).fill("zze2e");
  await page.getByRole("option", { name: /ZZE2E THPT Nguyễn Du - Châu Thành/ }).click();
  await code.getByRole("button", { name: "Tạo mã" }).click();
  const row = page.getByRole("row", { name: /ZZE2E VPB Nguyễn Du/ });
  await expect(row.getByText("Còn chỗ")).toBeVisible();
  await expect(row.getByText("0/200")).toBeVisible();
});

test("Nhân viên được giao một ngân hàng chỉ thấy ngân hàng đó", async ({ page }) => {
  await loginAs(page, "zz_e2e_admin");
  const status = await page.evaluate(async () => {
    const staff = (await (await fetch("/api/admin/users/options?q=zz_e2e_staff")).json())[0];
    const post = (body: object) => fetch("/api/admin/banks", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).then((r) => r.status);
    return [await post({ code: "ZZE2EA", name: "ZZE2E Ngân hàng giao", sortOrder: "1", managerIds: [staff.id] }), await post({ code: "ZZE2EB", name: "ZZE2E Ngân hàng khác", sortOrder: "2", managerIds: [] })];
  });
  expect(status).toEqual([201, 201]);
  await page.context().clearCookies();

  await loginAs(page, "zz_e2e_staff");
  await page.goto("/banks");
  await expect(page.getByRole("cell", { name: "ZZE2E Ngân hàng giao", exact: true })).toBeVisible();
  await expect(page.getByRole("cell", { name: "ZZE2E Ngân hàng khác", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Thêm ngân hàng" })).toHaveCount(0);
  await expect(page.getByRole("link", { name: "Trường" })).toHaveCount(0);
});
