import { expect, type Browser, type Locator, type Page } from "@playwright/test";

export const BASE = "http://admin.localhost:3100";
export const PASSWORD = "e2e23test";
export const ORIGIN = { Origin: BASE };
export const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };
export const DESKTOP = { viewport: { width: 1366, height: 768 } };
export const WARD = { provinceCode: "80", wardCode: "25585" };
export const LONG_WORD = "ZZE2E " + "Dài".repeat(40);

type Json = Record<string, unknown> | unknown[] | null;
export type ApiResult = { status: number; body: Json };

// Gọi API như trình duyệt cùng tên miền: page.request dùng chung cookie với trang, Origin phải gắn tay.
export async function api(page: Page, method: string, url: string, data?: unknown, headers: Record<string, string> = ORIGIN): Promise<ApiResult> {
  const res = await page.request.fetch(url, { method, data: data === undefined ? undefined : data, headers, maxRedirects: 0 });
  const text = await res.text();
  let body: Json = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return { status: res.status(), body };
}

export async function apiLogin(page: Page, username: string, password = PASSWORD) {
  const r = await api(page, "POST", "/api/admin/login", { username, password });
  expect(r.status, `đăng nhập ${username}`).toBe(204);
}

export async function newPage(browser: Browser, device: object = DESKTOP): Promise<Page> {
  return (await browser.newContext({ baseURL: BASE, ...device })).newPage();
}

// Mở trang rồi đợi React gắn sự kiện: dev server biên dịch lần đầu, bấm sớm thì nút không phản hồi.
export async function open(page: Page, path: string) {
  const res = await page.goto(path);
  await page.waitForLoadState("networkidle");
  return res;
}

export async function asUser(browser: Browser, username: string, password = PASSWORD, device: object = DESKTOP): Promise<Page> {
  const page = await newPage(browser, device);
  await apiLogin(page, username, password);
  return page;
}

type UserInput = { fullName: string; username: string; role?: "admin" | "manager" | "staff"; permissions?: string[]; title?: string; staffCode?: string; phone?: string };

export async function createUser(admin: Page, u: UserInput): Promise<{ id: string; password: string }> {
  const r = await api(admin, "POST", "/api/admin/users", { staffCode: "", phone: "", title: "", role: "staff", permissions: [], ...u });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return r.body as { id: string; password: string };
}

export async function createSchool(admin: Page, name: string, extra: Record<string, string> = {}): Promise<string> {
  const r = await api(admin, "POST", "/api/admin/schools", { name, ...WARD, contactName: "Người liên hệ", contactPhone: "0903111222", ...extra });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return (r.body as { id: string }).id;
}

export async function createBank(admin: Page, code: string, name: string, managerIds: string[] = [], sortOrder = "50"): Promise<string> {
  const r = await api(admin, "POST", "/api/admin/banks", { code, name, sortOrder, managerIds });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return (r.body as { id: string }).id;
}

export async function createCode(admin: Page, bankId: string, displayName: string, extra: Record<string, unknown> = {}): Promise<string> {
  const r = await api(admin, "POST", "/api/admin/referral-codes", { bankId, displayName, code: "ZZE2E-C", qrKey: null, openUrl: "", monthlyQuota: "10", priority: "0", schoolIds: [], ...extra });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  return (r.body as { id: string }).id;
}

export async function pageScroll(page: Page): Promise<{ scroll: number; client: number }> {
  return page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
}

export const box = (locator: Locator) => locator.evaluate((el) => el.getBoundingClientRect().toJSON() as { left: number; right: number; top: number; bottom: number; width: number; height: number });

// Hộp thoại không được rộng quá màn và nội dung không được tràn ra ngoài khung hộp (nút Đóng bị đẩy ra ngoài là lỗi).
export async function expectDialogFits(page: Page, dialog: Locator) {
  const width = page.viewportSize()!.width;
  const d = await box(dialog);
  expect(d.left).toBeGreaterThanOrEqual(0);
  expect(d.right).toBeLessThanOrEqual(width);
  const overflow = await dialog.evaluate((el) => el.scrollWidth - el.clientWidth);
  expect(overflow, "nội dung hộp thoại tràn ngang").toBeLessThanOrEqual(0);
  const close = await box(dialog.getByRole("button", { name: "Đóng", exact: true }).first());
  expect(close.right).toBeLessThanOrEqual(d.right);
}

export const formAlert = (scope: Page | Locator) => scope.locator('form [role="alert"]');
