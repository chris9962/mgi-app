import QRCode from "qrcode";
import { bankScreen } from "../../tests/support/bankScreen";
import { PHOTO, expect, loginAs, note, openMenu, test } from "./support";

const SCHOOL = "ZZE2E THPT Lê Quý Đôn";
const BANK = "ZZE2E VPBank Flow";
const CODE = "ZZE2E VPB Lê Quý Đôn";
const OPEN_URL = "https://example.com/mo-tai-khoan-le-quy-don";

test.use({ permissions: ["clipboard-read", "clipboard-write"] });

test("Flow 3: cấu hình trường, ngân hàng, hướng dẫn, mã giới thiệu, Kho mã theo tháng", async ({ page }) => {
  await loginAs(page, "zz_e2e_admin");

  await test.step("Tạo trường: chọn tỉnh, tìm xã", async () => {
    await openMenu(page, "Trường");
    await page.getByRole("button", { name: "Thêm trường" }).click();
    const form = page.getByRole("dialog", { name: "Thêm trường" });
    await form.getByLabel("Tên trường", { exact: true }).fill(SCHOOL);
    await form.getByLabel("Tỉnh/thành phố").selectOption({ label: "Tỉnh Tây Ninh" });
    await form.getByRole("combobox", { name: "Xã/phường" }).pressSequentially("chau thanh", { delay: 60 });
    await page.getByRole("option", { name: "Xã Châu Thành" }).click();
    await form.getByLabel("Họ tên người liên hệ").fill("Lê Thu Hương");
    await form.getByLabel("SĐT người liên hệ").fill("0903111222");
    await form.getByRole("button", { name: "Tạo trường" }).click();
    await expect(page.getByRole("row", { name: new RegExp(SCHOOL) })).toContainText("Châu Thành, Tây Ninh");
  });

  await test.step("Chép link trường, tải ảnh QR của trường", async () => {
    const row = page.getByRole("row", { name: new RegExp(SCHOOL) });
    await row.getByRole("button", { name: /Chép link/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "Đã chép link" })).toHaveCount(1);
    const link = await page.evaluate(() => navigator.clipboard.readText());
    expect(link).toMatch(/^http:\/\/bank\.localhost:3100\/t\/[0-9a-f-]{36}$/);
    const [download] = await Promise.all([page.waitForEvent("download"), row.getByRole("link", { name: `Tải ảnh QR của ${SCHOOL}` }).click()]);
    expect(download.suggestedFilename()).toBe("qr-ZZE2E-THPT-Le-Quy-Don.png");
    await note(page, [`Link đã chép: ${link}`, `Ảnh QR tải về: ${download.suggestedFilename()}`]);
  });

  await test.step("Tạo ngân hàng, giao người quản", async () => {
    await openMenu(page, "Ngân hàng", "Cấu hình dữ liệu");
    await page.getByRole("button", { name: "Thêm ngân hàng" }).click();
    const form = page.getByRole("dialog", { name: "Thêm ngân hàng" });
    await form.getByLabel("Mã ngân hàng").fill("ZZE2EF3");
    await form.getByLabel("Độ ưu tiên").fill("99");
    await form.getByLabel("Tên ngân hàng").fill(BANK);
    await form.getByRole("combobox", { name: "Người quản ngân hàng này" }).pressSequentially("zz_e2e_staff", { delay: 40 });
    await page.getByRole("option", { name: "E2E Nhân viên", exact: true }).click();
    await form.getByRole("button", { name: "Tạo ngân hàng" }).click();
    await expect(page.getByRole("row", { name: new RegExp(BANK) })).toContainText("E2E Nhân viên");
  });

  await test.step("Cài hướng dẫn và 2 khung ảnh có ảnh mẫu", async () => {
    await page.getByRole("button", { name: `Hướng dẫn mở tài khoản ${BANK}` }).click();
    const guide = page.getByRole("dialog", { name: /Hướng dẫn mở tài khoản/ });
    await guide.getByLabel("Các bước").fill("Tải app VPBank NEO.\nChọn Mở tài khoản, chụp CCCD và khuôn mặt.\nNhập mã giới thiệu bên dưới.");
    await guide.getByLabel("Tên ảnh 1").fill("Ảnh màn hình chính");
    const sample = async (slot: string, file: string | { name: string; mimeType: string; buffer: Buffer }) => {
      const [chooser] = await Promise.all([page.waitForEvent("filechooser"), guide.getByRole("button", { name: `Đổi ảnh mẫu của ${slot}` }).click()]);
      await chooser.setFiles(file);
      await expect(guide.getByRole("button", { name: `Đổi ảnh mẫu của ${slot}` }).locator("img")).toBeVisible({ timeout: 30_000 });
    };
    await sample("Ảnh màn hình chính", PHOTO);
    await guide.getByRole("button", { name: "Thêm ảnh" }).click();
    await guide.getByLabel("Tên ảnh 2").fill("Ảnh chuyển khoản");
    await sample("Ảnh chuyển khoản", { name: "mau-chuyen-khoan.png", mimeType: "image/png", buffer: Buffer.from(await bankScreen({ name: "NGUYEN VAN MAU", code: "MAU-01" }, "png")) });
    await guide.getByRole("button", { name: "Lưu" }).click();
    await expect(guide).toHaveCount(0);
    await page.reload();
    await expect(page.getByRole("row", { name: new RegExp(BANK) }).getByText("2 ảnh")).toBeVisible();
  });

  await test.step("Tạo mã giới thiệu có ảnh QR, gắn trường", async () => {
    await page.getByRole("navigation", { name: "Ngân hàng và mã giới thiệu" }).getByRole("link", { name: "Kho mã giới thiệu" }).click();
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Thêm mã" }).click();
    const form = page.getByRole("dialog", { name: "Thêm mã giới thiệu" });
    await form.getByLabel("Ngân hàng").selectOption({ label: BANK });
    await form.getByLabel("Tên hiển thị").fill(CODE);
    const qr = await QRCode.toBuffer(OPEN_URL, { width: 400, margin: 2 });
    const [chooser] = await Promise.all([page.waitForEvent("filechooser"), form.getByRole("button", { name: "Chọn ảnh QR" }).click()]);
    await chooser.setFiles({ name: "qr-ma-gioi-thieu.png", mimeType: "image/png", buffer: qr });
    await expect(form.getByRole("img", { name: "Ảnh QR đã chọn" })).toBeVisible({ timeout: 30_000 });
    await expect(form.getByLabel("Link mở tài khoản trong QR")).toHaveValue(OPEN_URL);
    await form.getByLabel("Mã text (Mã giới thiệu)").fill("LQD-E2E-01");
    await form.getByRole("combobox", { name: "Trường dùng mã này" }).pressSequentially("Lê Quý", { delay: 60 });
    await page.getByRole("option", { name: new RegExp(`${SCHOOL} - Châu Thành`) }).click();
    await form.getByRole("button", { name: "Tạo mã" }).click();
    await expect(form).toHaveCount(0);
  });

  await test.step("Kho mã: lọc theo ngân hàng ngay khi chọn, không có nút Lọc", async () => {
    await expect(page.getByRole("button", { name: "Lọc", exact: true })).toHaveCount(0);
    await page.getByRole("search").getByLabel("Ngân hàng").selectOption({ label: BANK });
    await expect(page).toHaveURL(/bank=/);
    await expect(page.getByRole("region", { name: "Kho mã giới thiệu" }).getByRole("row")).toHaveCount(2);
    // Seed ca biên đã lấp đủ 15 dòng trang 1, mã mới chỉ chắc chắn hiện sau khi lọc theo ngân hàng.
    const row = page.getByRole("row", { name: new RegExp(CODE) });
    await expect(row.getByText("Còn chỗ")).toBeVisible();
    await expect(row.getByText("0/200")).toBeVisible();
    await expect(row).toContainText(SCHOOL);
  });

  await test.step("Kho mã theo tháng: lùi một tháng rồi về tháng này", async () => {
    const month = new URL(page.url()).searchParams.get("month")!;
    await page.getByRole("link", { name: "Tháng trước" }).click();
    await expect(page).not.toHaveURL(new RegExp(`month=${month}`));
    await expect(page.getByRole("row", { name: new RegExp(CODE) }).getByText("0/200")).toBeVisible();
    await page.getByRole("link", { name: "Tháng sau" }).click();
    await expect(page).toHaveURL(new RegExp(`month=${month}`));
    await expect(page.getByText(`Tháng ${month.slice(5)}/${month.slice(0, 4)}`)).toBeVisible();
  });
});
