import ExcelJS from "exceljs";
import { expect, type Browser, type BrowserContext, type Locator, type Page } from "@playwright/test";

export const PASSWORD = "e2e23test";
export const ADMIN = "http://admin.localhost:3100";
export const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
export const DESKTOP = { viewport: { width: 1366, height: 768 } };

// Mỗi file spec gọi closeContexts sau từng test: context để lại thì phiên đăng nhập và route chặn còn sống tới hết file.
const contexts = new Set<BrowserContext>();
export const closeContexts = () => Promise.all([...contexts].map((c) => c.close()));

export async function loginAs(browser: Browser, username: string, device: object = DESKTOP): Promise<Page> {
  const context = await browser.newContext({ baseURL: ADMIN, ...device });
  contexts.add(context);
  context.on("close", () => contexts.delete(context));
  const page = await context.newPage();
  await page.goto("/login");
  await page.getByLabel("Tài khoản").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL(/\/(users|profile)$/);
  await page.waitForLoadState("networkidle");
  return page;
}

export async function open(page: Page, path: string) {
  const res = await page.goto(path);
  await page.waitForLoadState("networkidle");
  return res!.status();
}

// Số px cả trang trượt ngang; 0 là không tràn.
export const pageOverflow = (page: Page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

// Phần tử nằm trọn bề ngang màn hình: tràn thì nút bị cắt hoặc phải cuộn ngang mới bấm được.
export async function insideViewport(locator: Locator) {
  const r = await locator.evaluate((el) => {
    const b = el.getBoundingClientRect();
    return { left: Math.round(b.left), right: Math.round(b.right), width: innerWidth };
  });
  return r.left >= 0 && r.right <= r.width;
}

// Phần tử không có nội dung tràn ra ngoài khung của nó.
export const overflowOf = (locator: Locator) => locator.evaluate((el) => el.scrollWidth - el.clientWidth);

export type Sheet = { rows: string[][]; types: ExcelJS.ValueType[][] };

// Tải file qua route xuất, đọc lại bằng ExcelJS: 3 dòng đầu là nhóm, tổng, tên cột; dữ liệu từ dòng 4.
export async function readExport(page: Page, url: string): Promise<Sheet> {
  const res = await page.request.get(url);
  expect(res.status(), await res.text().catch(() => "")).toBe(200);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await res.body()) as unknown as ArrayBuffer);
  const ws = wb.worksheets[0];
  const rows: string[][] = [];
  const types: ExcelJS.ValueType[][] = [];
  ws.eachRow({ includeEmpty: true }, (row) => {
    const cells: string[] = [];
    const kinds: ExcelJS.ValueType[] = [];
    for (let c = 1; c <= ws.columnCount; c++) {
      const cell = row.getCell(c);
      cells.push(cell.value === null || cell.value === undefined ? "" : String(cell.value));
      kinds.push(cell.type);
    }
    rows.push(cells);
    types.push(kinds);
  });
  return { rows, types };
}

export const column = (sheet: Sheet, header: string, nth = 0) => sheet.rows[2].map((h, i) => (h === header ? i : -1)).filter((i) => i >= 0)[nth];
