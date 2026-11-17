import { E2E_STUDENT_SCHOOL_ID } from "../../scripts/e2e-data";
import { flowVideo } from "./video";
import { PHONE, PHOTO, STUDENT, expect, test } from "./support";

test.use({ ...PHONE, baseURL: STUDENT, video: flowVideo(390, 844) });

const NAME = "Trần Minh Anh";

test("Flow 4: học sinh mở link QR, chọn 2 ngân hàng, nộp ảnh, gửi kiểm tra", async ({ page }) => {
  const panel = page.getByRole("tabpanel");
  const tab = (name: string) => page.getByRole("tab", { name: new RegExp(name) });
  const pick = async (...names: string[]) => {
    await expect(page.getByRole("heading", { name: "Chọn ngân hàng" })).toBeVisible();
    for (const name of names) await page.getByRole("button", { name: new RegExp(name) }).click();
    for (const name of names) {
      await expect(page.getByRole("button", { name: new RegExp(name) })).toHaveAttribute("aria-pressed", "true");
      await expect(page.getByRole("button", { name: new RegExp(name) }).locator("svg")).toBeVisible();
    }
    await expect(page.getByText("Đã chọn 2.")).toBeVisible();
    await expect(page.getByText(/Ngân hàng \d/)).toHaveCount(0);
    await page.getByRole("button", { name: "Tiếp tục" }).click();
    await expect(page.getByRole("heading", { name: "Mở tài khoản" })).toBeVisible();
  };
  const upload = async (slot: string) => {
    await panel.getByLabel(`${slot}: chọn ảnh`).setInputFiles(PHOTO);
    await expect(panel.getByLabel(`${slot}: chọn lại`)).toBeAttached({ timeout: 30_000 });
  };

  await test.step("Mở web khi chưa quét QR", async () => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1, name: "Chưa có trường" })).toBeVisible();
  });

  await test.step("Mở link QR của trường", async () => {
    await page.goto(`/t/${E2E_STUDENT_SCHOOL_ID}`);
    await expect(page.getByRole("heading", { level: 1, name: "Thông tin" })).toBeVisible();
    await expect(page).toHaveURL(`${STUDENT}/`);
  });

  await test.step("Khai thông tin học sinh và phụ huynh", async () => {
    await page.getByLabel("Họ và tên", { exact: true }).fill(NAME);
    await page.getByLabel("Lớp").fill("11a3");
    await page.getByLabel("SĐT phụ huynh").fill("0987 654 321");
    await page.getByRole("checkbox", { name: "Đồng ý" }).check();
    await page.getByRole("button", { name: "Tiếp tục" }).click();
  });

  await test.step("Chọn 2 ngân hàng: hiện dấu tích, không ghi Ngân hàng 1, 2", async () => {
    await pick("ZZE2E HS VPBank", "ZZE2E HS TPBank");
    await expect(tab("ZZE2E HS VPBank")).toHaveAttribute("aria-selected", "true");
  });

  await test.step("Xem hướng dẫn, mã giới thiệu, bấm ảnh mẫu để xem phóng to", async () => {
    await expect(panel.getByRole("listitem").filter({ hasText: "Tải app VPBank." })).toBeVisible();
    await expect(panel.getByText("HS-VPBANK-01")).toBeVisible();
    await panel.getByRole("button", { name: "Xem ảnh mẫu Ảnh màn hình chính" }).click();
    const viewer = page.getByRole("dialog", { name: /Ảnh mẫu/ });
    await expect(viewer.getByRole("img")).toBeVisible();
    await viewer.getByRole("button", { name: "Đóng" }).click();
    await expect(viewer).toHaveCount(0);
  });

  await test.step("Bấm Quét QR code mở trang mở tài khoản của ngân hàng", async () => {
    await page.context().route("https://example.com/**", (route) => route.fulfill({ contentType: "text/html", body: "<h1>Trang mở tài khoản của ngân hàng</h1>" }));
    const [popup] = await Promise.all([page.context().waitForEvent("page"), panel.getByRole("link", { name: "Quét QR code" }).click()]);
    await popup.waitForLoadState();
    expect(popup.url()).toBe("https://example.com/mo-tai-khoan");
    await popup.close();
  });

  await test.step("Nộp một ảnh rồi Quay lại chọn ngân hàng", async () => {
    await upload("Ảnh màn hình chính");
    await expect(panel.getByText("Đã gửi")).toHaveCount(1);
    await page.getByRole("button", { name: "Quay lại chọn ngân hàng" }).click();
    const confirm = page.getByRole("dialog", { name: "Quay lại chọn ngân hàng" });
    await expect(confirm).toContainText("Xoá ảnh đã nộp và quay lại chọn ngân hàng?");
    await confirm.getByRole("button", { name: "Quay lại" }).click();
  });

  await test.step("Chọn lại 2 ngân hàng", async () => {
    await pick("ZZE2E HS VPBank", "ZZE2E HS TPBank");
    await expect(panel.getByText("Đã gửi")).toHaveCount(0);
  });

  await test.step("Nộp ảnh mọi khung: khung ghi Đã gửi, tab có dấu đủ ảnh", async () => {
    for (const [bank, slots] of [
      ["ZZE2E HS TPBank", ["Ảnh màn hình chính"]],
      ["ZZE2E HS VPBank", ["Ảnh màn hình chính", "Ảnh chuyển khoản"]],
    ] as const) {
      await tab(bank).click();
      for (const slot of slots) await upload(slot);
      await expect(panel.getByText("Đã gửi")).toHaveCount(slots.length);
      await expect(tab(bank)).toContainText("đủ ảnh");
    }
  });

  await test.step("Cuộn xuống: thanh tab ngân hàng dính đầu màn hình", async () => {
    const tabs = page.getByRole("tablist", { name: "Ngân hàng đã chọn" });
    expect((await tabs.boundingBox())!.y).toBeGreaterThan(50);
    await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: "smooth" }));
    await expect.poll(async () => Math.round((await tabs.boundingBox())!.y)).toBe(0);
    await expect(tabs).toBeInViewport();
  });

  await test.step("Gửi kiểm tra, thấy màn chờ", async () => {
    await page.getByRole("button", { name: "Gửi kiểm tra" }).click();
    await expect(page.getByRole("heading", { name: `${NAME} - 11A3` })).toBeVisible();
    await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
    await expect(page.getByText(/voucher/i)).toHaveCount(0);
    await page.reload();
    await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
    await expect(page.getByRole("button", { name: "Gửi kiểm tra" })).toHaveCount(0);
  });
});
