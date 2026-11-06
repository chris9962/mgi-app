import { execFileSync } from "node:child_process";
import { ADMIN, expect, loginAs, openMenu, test } from "./support";

const TEMPLATE = "{HO_TEN} lop {LOP} truong {TRUONG} da mo tai khoan {NGAN_HANG}. Ma uu dai: {MA_VOUCHER}";
const ZALO = "https://zalo.me/0909123456";
const PVI = "https://pvi.example/app-e2e";

test("Flow 8: Quản trị sửa mẫu SMS, link Zalo, link app PVI; xem Vận hành hệ thống", async ({ page }) => {
  await loginAs(page, "zz_e2e_admin");
  await openMenu(page, "Cài đặt");
  const template = page.getByLabel("Nội dung, không dấu");
  const zalo = page.getByLabel("Link Zalo");
  const pvi = page.getByLabel("Link app PVI");
  // Cài đặt là dữ liệu thật của DB local: giữ giá trị cũ để trả lại sau flow.
  const before = { smsTemplate: await template.inputValue(), zaloUrl: await zalo.inputValue(), pviAppUrl: await pvi.inputValue() };

  try {
    await test.step("Sửa mẫu SMS: bấm thêm biến, xem trước số ký tự", async () => {
      await template.fill("{HO_TEN} lop {LOP} truong {TRUONG} da mo tai khoan {NGAN_HANG}. Ma uu dai: ");
      await page.getByRole("button", { name: "Thêm MA_VOUCHER vào mẫu" }).click();
      await expect(template).toHaveValue(TEMPLATE);
      await expect(page.getByText(/^\d+\/160 ký tự, \d tin$/)).toBeVisible();
    });

    await test.step("Sửa link Zalo và link app PVI: QR vẽ lại ngay", async () => {
      await zalo.fill(ZALO);
      await expect(page.getByRole("img", { name: "QR kết bạn Zalo" })).toBeVisible();
      await pvi.fill(PVI);
      await expect(page.getByRole("img", { name: "QR tới app PVI" })).toBeVisible();
    });

    await test.step("Lưu cấu hình, tải lại trang vẫn giữ giá trị mới", async () => {
      await page.getByRole("button", { name: "Lưu cấu hình" }).click();
      await expect(page.getByRole("status").filter({ hasText: "Đã lưu cấu hình." })).toBeVisible();
      await page.reload();
      await expect(template).toHaveValue(TEMPLATE);
      await expect(zalo).toHaveValue(ZALO);
      await expect(pvi).toHaveValue(PVI);
    });
  } finally {
    const res = await page.request.patch(`${ADMIN}/api/admin/settings`, { headers: { Origin: ADMIN }, data: before });
    expect(res.ok()).toBe(true);
  }

  await test.step("Xem Trang 18 Vận hành hệ thống", async () => {
    // Một vòng đo thật của máy đang chạy flow; bỏ S3 để không duyệt cả bucket dev.
    execFileSync("bun", ["--env-file=.env.local", "scripts/ops-watch.ts", "--mot-vong"], { env: { ...process.env, S3_ENDPOINT: "" }, stdio: "ignore" });
    await openMenu(page, "Vận hành hệ thống");
    await expect(page.getByRole("heading", { level: 1, name: "Vận hành hệ thống" })).toBeVisible();
    const host = page.getByRole("region", { name: "Máy chủ" });
    await expect(host.getByText(/^Đo lúc \d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/)).toBeVisible();
    for (const label of ["CPU", "RAM", "Ổ đĩa"]) await expect(host.getByRole("img", { name: new RegExp(`^${label}: đã dùng \\d+ phần trăm$`) })).toBeVisible();
    const checks = page.getByRole("region", { name: "Kiểm ảnh" });
    await checks.scrollIntoViewIfNeeded();
    await expect(checks.getByText(/^\d+ lượt đang đợi$/)).toBeVisible();
    for (const h of ["Ngân hàng", "Đang đợi", "Đạt", "Không đạt", "Lỗi kiểm"]) await expect(checks.getByRole("table").getByRole("columnheader", { name: h, exact: true })).toBeVisible();
  });
});
