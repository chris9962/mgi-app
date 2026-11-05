import { expect, test } from "@playwright/test";
import { E2E_STUDENT_SCHOOL, E2E_STUDENT_SCHOOL_ID } from "../scripts/e2e-data";

test.use({ baseURL: "http://bank.localhost:3100", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const PHOTO = "public/brand/photo.jpg";

test("Học sinh quét link trường, khai thông tin, chọn 2 ngân hàng, nộp ảnh mọi khung, gửi kiểm tra", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Chưa có trường" })).toBeVisible();

  await page.goto(`/t/${E2E_STUDENT_SCHOOL_ID}`);
  await expect(page.getByText(E2E_STUDENT_SCHOOL)).toBeVisible();
  await expect(page).toHaveURL("http://bank.localhost:3100/");

  await page.getByLabel("Họ và tên", { exact: true }).fill("Trần Minh Anh");
  await page.getByLabel("Lớp").fill("11 a3");
  await page.getByLabel("SĐT", { exact: true }).fill("0912 345 678");
  await page.getByLabel("Họ và tên phụ huynh").fill("Trần Văn Hùng");
  await page.getByLabel("SĐT phụ huynh").fill("0912345678");
  await page.getByLabel("SĐT phụ huynh").blur();
  await expect(page.getByText("SĐT phụ huynh phải khác SĐT học sinh.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Tiếp tục" })).toBeDisabled();
  await page.getByLabel("SĐT phụ huynh").fill("0987654321");
  await page.getByRole("checkbox", { name: "ZZE2E HS MB" }).check();
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  await expect(page.getByRole("heading", { name: "Chọn 2 ngân hàng" })).toBeVisible();
  await expect(page.getByRole("button", { name: /ZZE2E HS MB/ })).toHaveCount(0);
  await page.getByRole("button", { name: /ZZE2E HS TPBank/ }).click();
  await page.getByRole("button", { name: /ZZE2E HS VPBank/ }).click();
  await expect(page.getByRole("button", { name: /ZZE2E HS TPBank/ })).toContainText("Ngân hàng 1");
  await expect(page.getByText("Đã chọn 2/2.")).toBeVisible();
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  await expect(page.getByRole("heading", { name: "Mở tài khoản" })).toBeVisible();
  await expect(page.getByRole("tab", { name: /ZZE2E HS TPBank/ })).toHaveAttribute("aria-selected", "true");
  const send = page.getByRole("button", { name: "Gửi kiểm tra" });
  await expect(send).toBeDisabled();

  await page.getByRole("tab", { name: /ZZE2E HS VPBank/ }).click();
  const panel = page.getByRole("tabpanel");
  await expect(panel.getByText("HS-VPBANK-01")).toBeVisible();
  await expect(panel.getByRole("link", { name: "Quét QR code" })).toHaveAttribute("href", "https://example.com/mo-tai-khoan");
  await panel.getByRole("button", { name: "Xem ảnh mẫu Ảnh màn hình chính" }).click();
  await expect(page.getByRole("dialog", { name: /Ảnh mẫu/ }).getByRole("img")).toBeVisible();
  await page.getByRole("dialog", { name: /Ảnh mẫu/ }).getByRole("button", { name: "Đóng" }).click();

  for (const tab of ["ZZE2E HS VPBank", "ZZE2E HS TPBank"]) {
    await page.getByRole("tab", { name: new RegExp(tab) }).click();
    const names = await panel.locator('input[type="file"]').evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")!.split(":")[0]));
    for (const name of names) {
      await panel.getByLabel(`${name}: chụp hoặc chọn ảnh`).setInputFiles(PHOTO);
      await expect(panel.getByLabel(`${name}: chụp lại`)).toBeAttached({ timeout: 30_000 });
    }
    await expect(page.getByRole("tab", { name: new RegExp(tab) })).toContainText("đủ ảnh");
  }

  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
  await expect(page.getByText("Phụ huynh nhận SMS khi có ngân hàng đạt.")).toBeVisible();
  await expect(page.getByText("Gửi tới 0987 •••• 321")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Trần Minh Anh - 11A3" })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Gửi kiểm tra" })).toHaveCount(0);
});
