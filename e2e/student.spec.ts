import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";
import sharp from "sharp";
import { E2E_STUDENT_SCHOOL, E2E_STUDENT_SCHOOL_ID } from "../scripts/e2e-data";

test.use({ baseURL: "http://bank.localhost:3100", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

const PHOTO = "public/brand/photo.jpg";

test("Học sinh quét link trường, khai thông tin, chọn 2 ngân hàng, nộp ảnh mọi khung, gửi kiểm tra", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1, name: "Chưa có trường" })).toBeVisible();

  await page.goto(`/t/${E2E_STUDENT_SCHOOL_ID}`);
  await expect(page.getByText(E2E_STUDENT_SCHOOL)).toBeVisible();
  await expect(page).toHaveURL("http://bank.localhost:3100/");

  await page.getByLabel("Họ và tên", { exact: true }).fill("Trần Minh Anh");
  await page.getByLabel("Lớp").fill("11 a3");
  await page.getByLabel("SĐT phụ huynh").fill("0987 654 321");
  await page.getByRole("checkbox", { name: "Đồng ý" }).check();
  // Logo đọc từ S3 qua link đã ký: ảnh tải được thì có chiều rộng thật.
  await expect.poll(() => page.locator("label", { hasText: "ZZE2E HS MB" }).locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("checkbox", { name: "ZZE2E HS MB" }).check();
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  await expect(page.getByRole("heading", { name: "Chọn 2 ngân hàng" })).toBeVisible();
  await expect(page.getByRole("button", { name: /ZZE2E HS MB/ })).toHaveCount(0);
  await expect.poll(() => page.getByRole("button", { name: /ZZE2E HS VPBank/ }).locator("img").evaluate((img: HTMLImageElement) => img.naturalWidth)).toBeGreaterThan(0);
  await page.getByRole("button", { name: /ZZE2E HS TPBank/ }).click();
  await page.getByRole("button", { name: /ZZE2E HS VPBank/ }).click();
  await expect(page.getByRole("button", { name: /ZZE2E HS TPBank/ })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByText(/Ngân hàng \d/)).toHaveCount(0);
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
      await panel.getByLabel(`${name}: chọn ảnh`).setInputFiles(PHOTO);
      await expect(panel.getByLabel(`${name}: chọn lại`)).toBeAttached({ timeout: 30_000 });
    }
    await expect(page.getByRole("tab", { name: new RegExp(tab) })).toContainText("đủ ảnh");
  }

  await expect(send).toBeEnabled();
  await send.click();
  await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
  await expect(page.getByText(/voucher/i)).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Trần Minh Anh - 11A3" })).toBeVisible();

  await page.reload();
  await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
  await expect(page.getByRole("button", { name: "Gửi kiểm tra" })).toHaveCount(0);
});

test("đang tải ảnh thì không gửi kiểm tra được; tải ảnh lỗi thì khung báo lỗi và thử lại được", async ({ page }) => {
  await page.goto(`/t/${E2E_STUDENT_SCHOOL_ID}`);
  await page.getByLabel("Họ và tên", { exact: true }).fill("Lê Hoàng Nam");
  await page.getByLabel("Lớp").fill("10b1");
  await page.getByLabel("SĐT phụ huynh").fill("0987000111");
  await page.getByRole("checkbox", { name: "Đồng ý" }).check();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: /ZZE2E HS MB/ }).click();
  await page.getByRole("button", { name: /ZZE2E HS TPBank/ }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();

  const panel = page.getByRole("tabpanel");
  const send = page.getByRole("button", { name: "Gửi kiểm tra" });
  for (const tab of ["ZZE2E HS MB", "ZZE2E HS TPBank"]) {
    await page.getByRole("tab", { name: new RegExp(tab) }).click();
    await panel.getByLabel("Ảnh màn hình chính: chọn ảnh").setInputFiles(PHOTO);
    await expect(panel.getByLabel("Ảnh màn hình chính: chọn lại")).toBeAttached({ timeout: 30_000 });
  }
  await expect(send).toBeEnabled();

  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/api/customers/me/photos", async (route) => {
    await gate;
    await route.continue();
  });
  await panel.getByLabel("Ảnh màn hình chính: chọn lại").setInputFiles(PHOTO);
  await expect(panel.getByText("Đang tải ảnh")).toBeVisible();
  await expect(send).toBeDisabled();
  release();
  await expect(panel.getByText("Đang tải ảnh")).toHaveCount(0, { timeout: 30_000 });
  await expect(send).toBeEnabled();
  await page.unroute("**/api/customers/me/photos");

  await page.route("**/api/customers/me/photos", (route) => route.abort("connectionreset"));
  await panel.getByLabel("Ảnh màn hình chính: chọn lại").setInputFiles(PHOTO);
  await expect(panel.getByRole("alert")).toContainText("Không tải được ảnh");
  await expect(panel.getByText("Đang tải ảnh")).toHaveCount(0);
  await page.unroute("**/api/customers/me/photos");
  await panel.getByLabel("Ảnh màn hình chính: chọn lại").setInputFiles(PHOTO);
  await expect(panel.getByRole("alert")).toHaveCount(0, { timeout: 30_000 });
  await expect(send).toBeEnabled();
});

test("ảnh 15 MB gửi qua API tới đủ route: proxy không cắt body ở 10 MB, máy chủ đổi sang WebP", async ({ request }) => {
  const origin = "http://bank.localhost:3100";
  const created = await request.post("/api/customers", {
    headers: { Origin: origin },
    data: { schoolId: E2E_STUDENT_SCHOOL_ID, fullName: "Đặng Ảnh Lớn", className: "12c1", parentPhone: "0987000222", consent: true, existingBankIds: [] },
  });
  expect(created.status()).toBe(201);
  const auth = { Origin: origin, Authorization: `Bearer ${(await created.json()).token}` };
  const me = async () => (await request.get("/api/customers/me", { headers: auth })).json();
  const eligible: { id: string }[] = (await me()).eligibleBanks;
  expect((await request.post("/api/customers/me/banks", { headers: auth, data: { bankIds: eligible.slice(0, 2).map((b) => b.id) } })).status()).toBe(204);
  const [bank] = (await me()).banks;
  // Ảnh nhiễu không nén được: PNG giữ gần đủ 15 MB điểm ảnh thô.
  const png = await sharp(randomBytes(2240 * 2240 * 3), { raw: { width: 2240, height: 2240, channels: 3 } }).png({ compressionLevel: 0 }).toBuffer();
  expect(png.length).toBeGreaterThan(14 * 1024 * 1024);
  const res = await request.post("/api/customers/me/photos", { headers: auth, multipart: { customerBankId: bank.id, slotId: bank.slots[0].id, file: { name: "IMG_0002.png", mimeType: "image/png", buffer: png } } });
  expect(res.status()).toBe(201);
  const [after] = (await me()).banks;
  expect(after.slots[0].photo.sizeBytes).toBeLessThan(png.length);
});
