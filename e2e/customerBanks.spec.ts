import { expect, test, type Browser, type Page } from "@playwright/test";
import { E2E_STUDENT_SCHOOL_ID } from "../scripts/e2e-data";
import { openSidebarGroups } from "./sidebar-groups";

const PASSWORD = "e2e23test";
const STUDENT = "Lương Thị Hai Dòng";
const QUERY = `q=${encodeURIComponent("luong thi hai dong")}`;

async function loginAs(browser: Browser, username: string): Promise<Page> {
  const page = await (await browser.newContext({ baseURL: "http://admin.localhost:3100", viewport: { width: 1366, height: 768 } })).newPage();
  await page.goto("/login");
  await page.getByLabel("Tài khoản").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/(users|profile)$/);
  await page.waitForLoadState("networkidle");
  return page;
}

// Học sinh khai rồi chọn VPBank trước, TPBank sau: mỗi ngân hàng một dòng customer_banks, chưa cần nộp ảnh.
async function studentWithTwoBanks(browser: Browser) {
  const page = await (await browser.newContext({ baseURL: "http://bank.localhost:3100", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
  await page.goto(`/t/${E2E_STUDENT_SCHOOL_ID}`);
  await page.getByLabel("Họ và tên", { exact: true }).fill(STUDENT);
  await page.getByLabel("Lớp").fill("10a1");
  await page.getByLabel("SĐT", { exact: true }).fill("0933555777");
  await page.getByLabel("Họ và tên phụ huynh").fill("Lương Văn Cha");
  await page.getByLabel("SĐT phụ huynh").fill("0977555777");
  await page.getByRole("checkbox", { name: "Đồng ý" }).check();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await page.getByRole("button", { name: /ZZE2E HS VPBank/ }).click();
  await page.getByRole("button", { name: /ZZE2E HS TPBank/ }).click();
  await page.getByRole("button", { name: "Tiếp tục" }).click();
  await expect(page.getByRole("heading", { name: "Mở tài khoản" })).toBeVisible();
  await page.context().close();
}

const rowsOf = (page: Page) => page.getByRole("region", { name: "Ngân hàng", exact: true }).getByRole("row", { name: new RegExp(STUDENT) });

test("Trang Ngân hàng: học sinh chọn 2 ngân hàng ra 2 dòng, lọc theo ngân hàng, Nhân viên chỉ thấy dòng ngân hàng mình quản; Trang 3 gộp một cột Ngân hàng", async ({ browser }) => {
  test.setTimeout(90_000);
  await studentWithTwoBanks(browser);

  const admin = await loginAs(browser, "zz_e2e_admin");
  await openSidebarGroups(admin);
  const work = admin.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("listitem").filter({ has: admin.getByRole("button", { name: "Nghiệp vụ" }) });
  await work.getByRole("link", { name: "Ngân hàng", exact: true }).click();
  await expect(admin).toHaveURL(/\/customer-banks$/);
  await expect(admin.getByRole("heading", { level: 1, name: "Ngân hàng" })).toBeVisible();
  await expect(admin).toHaveTitle(/^Ngân hàng - /);
  await admin.goto("/banks");
  await expect(admin).toHaveTitle(/^Ngân hàng & mã giới thiệu - /);

  await admin.goto(`/customer-banks?${QUERY}`);
  await expect(rowsOf(admin)).toHaveCount(2);
  await expect(rowsOf(admin).nth(0)).toContainText("ZZE2E HS VPBank");
  await expect(rowsOf(admin).nth(0)).toContainText("HS-VPBANK-01");
  await expect(rowsOf(admin).nth(0)).toContainText("Đang tạo");
  await expect(rowsOf(admin).nth(1)).toContainText("ZZE2E HS TPBank");
  await expect(rowsOf(admin).nth(1)).toContainText("10A1");

  await admin.getByRole("button", { name: "Bộ lọc" }).click();
  await admin.getByRole("navigation", { name: "Mục lọc" }).getByRole("button", { name: "Ngân hàng" }).click();
  await admin.getByRole("checkbox", { name: "ZZE2E HS TPBank" }).check();
  await expect(admin).toHaveURL(/bank=/);
  await admin.getByRole("button", { name: "Xong" }).click();
  await expect(admin.getByText("Ngân hàng: ZZE2E HS TPBank")).toBeVisible();
  await expect(rowsOf(admin)).toHaveCount(1);
  await expect(rowsOf(admin)).toContainText("ZZE2E HS TPBank");
  await admin.getByRole("link", { name: "Bỏ lọc Ngân hàng: ZZE2E HS TPBank" }).click();
  await expect(rowsOf(admin)).toHaveCount(2);

  await rowsOf(admin).nth(1).getByRole("link", { name: "ZZE2E HS TPBank" }).click();
  await expect(admin.getByRole("heading", { level: 1, name: STUDENT })).toBeVisible();

  await admin.goto(`/customers?${QUERY}`);
  const table = admin.getByRole("region", { name: "Hồ sơ học sinh" });
  await expect(table.getByRole("columnheader", { name: "Ngân hàng", exact: true })).toBeVisible();
  await expect(table.getByText(/Ngân hàng \d/)).toHaveCount(0);
  const cell = table.getByRole("row", { name: new RegExp(STUDENT) }).getByRole("listitem");
  await expect(cell).toHaveCount(2);
  await expect(cell.nth(0)).toContainText("ZZE2E HS VPBank");
  await expect(cell.nth(1)).toContainText("ZZE2E HS TPBank");

  const reviewer = await loginAs(browser, "zz_e2e_reviewer");
  await reviewer.goto(`/customer-banks?${QUERY}`);
  await expect(rowsOf(reviewer)).toHaveCount(1);
  await expect(rowsOf(reviewer)).toContainText("ZZE2E HS VPBank");
  await reviewer.getByRole("button", { name: "Bộ lọc" }).click();
  await expect(reviewer.getByRole("navigation", { name: "Mục lọc" }).getByRole("button", { name: "Ngân hàng" })).toHaveCount(0);
});

test("Bộ lọc: Esc trong ô tìm trường chỉ đóng gợi ý, Esc lần nữa đóng bảng và trả focus về nút Bộ lọc", async ({ browser }) => {
  const admin = await loginAs(browser, "zz_e2e_admin");
  await admin.goto("/customer-banks");
  const button = admin.getByRole("button", { name: "Bộ lọc" });
  await button.click();
  await admin.getByRole("navigation", { name: "Mục lọc" }).getByRole("button", { name: "Trường" }).click();
  const search = admin.getByRole("combobox", { name: "Trường" });
  await search.fill("zze2e");
  await expect(admin.getByRole("listbox")).toBeVisible();
  await search.press("Escape");
  await expect(admin.getByRole("listbox")).toHaveCount(0);
  await expect(admin.getByRole("button", { name: "Xong" })).toBeVisible();
  await search.press("Escape");
  await expect(admin.getByRole("button", { name: "Xong" })).toHaveCount(0);
  await expect(button).toBeFocused();
});

test("Bộ lọc: chọn 2 ngân hàng thì mục Ngân hàng ghi 2, nút Bộ lọc không đeo số", async ({ browser }) => {
  const admin = await loginAs(browser, "zz_e2e_admin");
  await admin.goto("/customer-banks");
  await admin.getByRole("button", { name: "Bộ lọc" }).click();
  const sections = admin.getByRole("navigation", { name: "Mục lọc" });
  await sections.getByRole("button", { name: "Ngân hàng" }).click();
  await admin.getByRole("checkbox", { name: "ZZE2E HS VPBank" }).check();
  await admin.getByRole("checkbox", { name: "ZZE2E HS TPBank" }).check();
  await expect(admin).toHaveURL(/bank=[^&]+%2C/);
  await expect(sections.getByRole("button", { name: "Ngân hàng" })).toHaveText("Ngân hàng2");
  await expect(admin.getByRole("button", { name: /^Bộ lọc/ })).toHaveText("Bộ lọc");
});
