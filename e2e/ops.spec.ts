import { execFileSync } from "node:child_process";
import { expect, test, type Page } from "@playwright/test";

const PASSWORD = "e2e23test";

async function loginAs(page: Page, username: string) {
  await page.goto("/login");
  await page.getByLabel("Tài khoản").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/(users|profile)$/);
  await page.waitForLoadState("networkidle");
}

test("Quản trị mở Vận hành hệ thống từ menu Hệ thống: khối Máy chủ có 4 ô đo, khối Kiểm ảnh có bảng theo ngân hàng", async ({ page }) => {
  // Một vòng đo thật của máy đang chạy test; bỏ S3 để không duyệt cả bucket dev.
  execFileSync("bun", ["--env-file=.env.local", "scripts/ops-watch.ts", "--mot-vong"], { env: { ...process.env, S3_ENDPOINT: "" }, stdio: "ignore" });
  await loginAs(page, "zz_e2e_admin");
  await page.getByRole("navigation").getByRole("link", { name: "Vận hành hệ thống" }).click();
  await expect(page.getByRole("heading", { name: "Vận hành hệ thống", level: 1 })).toBeVisible();

  const host = page.getByRole("region", { name: "Máy chủ" });
  await expect(host.getByText(/^Đo lúc \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)).toBeVisible();
  for (const label of ["CPU", "RAM", "Ổ đĩa"]) await expect(host.getByRole("img", { name: new RegExp(`^${label}: đã dùng \\d+ phần trăm$`) })).toBeVisible();
  await expect(host.getByText(/^\d+% trong một phút$/)).toBeVisible();
  await expect(host.getByText("S3", { exact: true })).toBeVisible();

  const checks = page.getByRole("region", { name: "Kiểm ảnh" });
  await expect(checks.getByText(/^\d+ lượt đang đợi$/)).toBeVisible();
  await expect(checks.getByText("Đang đợi kiểm")).toBeVisible();
  await expect(checks.getByText("Lượt đợi lâu nhất")).toBeVisible();
  const table = checks.getByRole("table");
  for (const h of ["Ngân hàng", "Đang đợi", "Đạt", "Không đạt", "Lỗi kiểm"]) await expect(table.getByRole("columnheader", { name: h, exact: true })).toBeVisible();
});

test("Nhân viên không thấy mục Vận hành hệ thống và mở thẳng thì nhận 404", async ({ page }) => {
  await loginAs(page, "zz_e2e_staff");
  await expect(page.getByRole("link", { name: "Vận hành hệ thống" })).toHaveCount(0);
  const res = await page.goto("/ops");
  expect(res?.status()).toBe(404);
});
