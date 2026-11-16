import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { bankScreen } from "../tests/support/bankScreen";
import { E2E_STUDENT_SCHOOL_ID } from "../scripts/e2e-data";

const PASSWORD = "e2e23test";
const STUDENT = "Lý Thị Kiểm Ảnh";
// Worker đọc OCR_PYTHON từ .env.local; máy chưa cài OCR thì bỏ qua ca này.
const ocrReady = /^OCR_PYTHON=.+$/m.test(readFileSync(".env.local", "utf8"));

async function loginAs(browser: Browser, username: string): Promise<Page> {
  const page = await (await browser.newContext({ baseURL: "http://admin.localhost:3100" })).newPage();
  await page.goto("/login");
  await page.getByLabel("Tài khoản").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/(users|profile)$/);
  return page;
}

// Ảnh VPBank có đúng họ tên và mã; ảnh TPBank có mã dư một số (HS-TPBANK-010) nên phải không đạt.
async function submitWithScreens(browser: Browser) {
  const screens: Record<string, Buffer> = {
    "ZZE2E HS VPBank": Buffer.from(await bankScreen({ name: "LÝ THỊ KIỂM ẢNH", code: "HS-VPBANK-01" }, "png")),
    "ZZE2E HS TPBank": Buffer.from(await bankScreen({ name: "LÝ THỊ KIỂM ẢNH", code: "HS-TPBANK-010" }, "png")),
  };
  const page = await (await browser.newContext({ baseURL: "http://bank.localhost:3100", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await page.goto(`/t/${E2E_STUDENT_SCHOOL_ID}`);
  await page.getByLabel("Họ và tên", { exact: true }).fill(STUDENT);
  await page.getByLabel("Lớp").fill("10a4");
  await page.getByLabel("SĐT", { exact: true }).fill("0977000111");
  await page.getByLabel("SĐT phụ huynh").fill("0977000222");
  await page.getByRole("checkbox", { name: "Đồng ý" }).check();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: /ZZE2E HS VPBank/ }).click();
  await page.getByRole("button", { name: /ZZE2E HS TPBank/ }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  const panel = page.getByRole("tabpanel");
  for (const [tab, buffer] of Object.entries(screens)) {
    await page.getByRole("tab", { name: new RegExp(tab) }).click();
    const names = await panel.locator('input[type="file"]').evaluateAll((els) => els.map((el) => el.getAttribute("aria-label")!.split(":")[0]));
    for (const name of names) {
      await panel.getByLabel(`${name}: chọn ảnh`).setInputFiles({ name: "man-hinh.png", mimeType: "image/png", buffer });
      await expect(panel.getByLabel(`${name}: chọn lại`)).toBeAttached({ timeout: 30_000 });
    }
  }
  await page.getByRole("button", { name: "Gửi kiểm tra" }).click();
  await expect(page.getByText("Chờ kiểm tra")).toHaveCount(2);
  await expect(page.getByText("Xác thực ảnh")).toHaveCount(0);
}

test("Học sinh nộp ảnh có họ tên và mã, worker kiểm một vòng: Trang 4 hiện Đạt và Không đạt từng khung, Trang 3 hiện x/y và lọc được", async ({ browser }) => {
  test.skip(!ocrReady, "Thiếu OCR_PYTHON trong .env.local");
  test.setTimeout(300_000);
  await submitWithScreens(browser);

  execFileSync("bun", ["--env-file=.env.local", "scripts/photo-check-worker.ts", "--mot-vong", `--truong=${E2E_STUDENT_SCHOOL_ID}`], { stdio: "inherit", timeout: 240_000 });

  const admin = await loginAs(browser, "zz_e2e_admin");
  await admin.goto(`/customers?q=${encodeURIComponent("ly thi kiem anh")}`);
  const row = admin.getByRole("row", { name: new RegExp(STUDENT) });
  await expect(row).toContainText("Xác thực ảnh 1/1");
  await expect(row).toContainText("Xác thực ảnh 0/1");

  await row.getByRole("link", { name: STUDENT }).click();
  const vpbank = admin.getByRole("region", { name: "ZZE2E HS VPBank" });
  const vpCheck = vpbank.getByRole("region", { name: "Xác thực ảnh" });
  await expect(vpCheck.getByRole("listitem")).toHaveCount(1);
  await expect(vpCheck.getByRole("listitem")).toContainText("Đạt");
  await expect(vpCheck).toContainText("Ảnh màn hình chính");
  await expect(vpCheck).toContainText("Họ tên và mã giới thiệu");
  await expect(vpCheck).toContainText(`Hệ thống: ${STUDENT} - HS-VPBANK-01`);
  await expect(vpbank.getByText("Chờ kiểm tra")).toBeVisible();

  const tpCheck = admin.getByRole("region", { name: "ZZE2E HS TPBank" }).getByRole("region", { name: "Xác thực ảnh" });
  await expect(tpCheck).toContainText("Không đạt");
  await expect(tpCheck).toContainText("Không tìm thấy mã giới thiệu HS-TPBANK-01 trong ảnh.");
  await expect(tpCheck).not.toContainText("HS-TPBANK-010");

  await admin.goto(`/customers?check=full&q=${encodeURIComponent("ly thi kiem anh")}`);
  await expect(admin.getByRole("row", { name: new RegExp(STUDENT) })).toBeVisible();
  await admin.goto(`/customers?check=missing&q=${encodeURIComponent("ly thi kiem anh")}`);
  await expect(admin.getByRole("row", { name: new RegExp(STUDENT) })).toBeVisible();
});
