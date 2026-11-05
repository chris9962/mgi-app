import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E_STUDENT_SCHOOL_ID } from "../scripts/e2e-data";

const PASSWORD = "e2e23test";
const PHOTO = "public/brand/photo.jpg";
const STUDENT = "Ngô Thị Hậu Kiểm";

async function loginAs(browser: Browser, username: string): Promise<Page> {
  const page = await (await browser.newContext({ baseURL: "http://admin.localhost:3100" })).newPage();
  await page.goto("/login");
  await page.getByLabel("Tài khoản").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/(users|profile)$/);
  await page.waitForLoadState("networkidle");
  return page;
}

// Học sinh khai, chọn VPBank và TPBank, nộp ảnh mọi khung, gửi kiểm tra; giữ trang để xem lại màn kết quả.
async function submittedStudent(browser: Browser): Promise<Page> {
  const page = await (await browser.newContext({ baseURL: "http://bank.localhost:3100", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await page.goto(`/t/${E2E_STUDENT_SCHOOL_ID}`);
  await page.getByLabel("Họ và tên", { exact: true }).fill(STUDENT);
  await page.getByLabel("Lớp").fill("12c2");
  await page.getByLabel("SĐT", { exact: true }).fill("0933222444");
  await page.getByLabel("Họ và tên phụ huynh").fill("Ngô Văn Phụ");
  await page.getByLabel("SĐT phụ huynh").fill("0977123456");
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: /ZZE2E HS VPBank/ }).click();
  await page.getByRole("button", { name: /ZZE2E HS TPBank/ }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  const panel = page.getByRole("tabpanel");
  for (const tab of ["ZZE2E HS VPBank", "ZZE2E HS TPBank"]) {
    await page.getByRole("tab", { name: new RegExp(tab) }).click();
    const names = await panel.locator('input[type="file"]').evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")!.split(":")[0]));
    for (const name of names) {
      await panel.getByLabel(`${name}: chụp hoặc chọn ảnh`).setInputFiles(PHOTO);
      await expect(panel.getByLabel(`${name}: chụp lại`)).toBeAttached({ timeout: 30_000 });
    }
  }
  await page.getByRole("button", { name: "Gửi kiểm tra" }).click();
  await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
  return page;
}

test("Người quản ngân hàng đánh dấu Đạt, voucher hiện ở Trang 4, Trang 12 và màn kết quả của học sinh; ảnh ngân hàng khác không hiện", async ({ browser }) => {
  test.setTimeout(120_000);
  const student = await submittedStudent(browser);

  const admin = await loginAs(browser, "zz_e2e_admin");
  await admin.goto(`/customers?q=${encodeURIComponent("ngo thi hau kiem")}`);
  await admin.getByRole("link", { name: STUDENT }).click();
  const tpbank = admin.getByRole("region", { name: "ZZE2E HS TPBank" });
  const otherPhoto = await tpbank.getByRole("img").first().evaluate((img) => (img as HTMLImageElement).getAttribute("src")!);
  expect(otherPhoto).toMatch(/^\/api\/admin\/photos\//);

  const reviewer = await loginAs(browser, "zz_e2e_reviewer");
  await reviewer.goto("/customers");
  await expect(reviewer.getByRole("row", { name: new RegExp(STUDENT) })).toContainText("Chờ");
  await reviewer.getByRole("link", { name: STUDENT }).click();
  const vpbank = reviewer.getByRole("region", { name: "ZZE2E HS VPBank" });
  await expect(vpbank.getByRole("img", { name: `Ảnh màn hình chính của ${STUDENT}` })).toBeVisible();
  await expect(vpbank.getByRole("img", { name: `Ảnh chuyển khoản của ${STUDENT}` })).toBeVisible();
  await expect(reviewer.getByRole("region", { name: "ZZE2E HS TPBank" }).getByRole("img")).toHaveCount(0);
  await expect(reviewer.getByRole("region", { name: "ZZE2E HS TPBank" }).getByRole("button")).toHaveCount(0);
  expect((await reviewer.request.get(otherPhoto, { maxRedirects: 0 })).status()).toBe(404);

  await vpbank.getByRole("button", { name: "Đạt", exact: true }).click();
  await reviewer.getByRole("dialog", { name: "Đánh dấu Đạt" }).getByRole("button", { name: "Đạt" }).click();
  const sms = reviewer.getByRole("region", { name: "SMS cho phụ huynh" });
  await expect(sms.locator("dd").first()).toHaveText(/^ZZE2ETHPTHS-NTHK-12C2-[23456789A-HJKMNP-Z]{4}$/);
  await expect(vpbank.getByRole("button", { name: "Đạt", exact: true })).toHaveCount(0);
  const code = (await sms.locator("dd").first().textContent())!.trim();
  await expect(reviewer.getByRole("button", { name: "Sửa thông tin" })).toHaveCount(0);

  await reviewer.goto("/vouchers");
  await expect(reviewer.getByRole("row", { name: new RegExp(code) })).toContainText(STUDENT);

  await student.reload();
  await expect(student.getByRole("img", { name: "QR mở app PVI" })).toBeVisible();
  await expect(student.getByText(code)).toHaveCount(0);
});

test("Bộ lọc hồ sơ ghi lên URL, chip bỏ được lọc, Esc đóng bảng và trả focus về nút", async ({ browser }) => {
  const page = await loginAs(browser, "zz_e2e_admin");
  await page.goto("/customers");
  await page.waitForLoadState("networkidle");
  const trigger = page.getByRole("button", { name: "Bộ lọc" });
  await trigger.click();
  await page.getByRole("radio", { name: "Chờ kiểm tra" }).check();
  await expect(page).toHaveURL(/status=pending_review/);
  await page.getByRole("button", { name: "Số ngân hàng đạt" }).click();
  await page.getByRole("radio", { name: "Đạt 1 ngân hàng" }).check();
  await expect(page).toHaveURL(/passed=1/);
  await page.keyboard.press("Escape");
  await expect(page.getByRole("radio")).toHaveCount(0);
  await expect(trigger).toBeFocused();
  await page.getByRole("link", { name: "Bỏ lọc Trạng thái: Chờ kiểm tra" }).click();
  await expect(page).not.toHaveURL(/status=/);
  await expect(page).toHaveURL(/passed=1/);
});
