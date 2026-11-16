import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { test as base, expect, type Page } from "@playwright/test";
import { E2E_STUDENT_SCHOOL_ID } from "../../scripts/e2e-data";
import { openSidebarGroups } from "../sidebar-groups";

export { expect };
export const ADMIN = "http://admin.localhost:3100";
export const STUDENT = "http://bank.localhost:3100";
export const PASSWORD = "e2e23test";
export const PHOTO = "public/brand/photo.jpg";
export const PHONE = { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

// Huy hiệu của dev server nằm góc dưới, đè nút và lọt vào video; bản chạy thật không có huy hiệu này.
export const test = base.extend({
  page: async ({ page }, provide) => {
    await page.context().addInitScript(() =>
      document.addEventListener("DOMContentLoaded", () => document.head.append(Object.assign(document.createElement("style"), { textContent: "nextjs-portal{display:none!important}" }))),
    );
    await provide(page);
    // Giữ màn cuối một lúc để video kịp hiện kết quả trước khi đóng trang.
    await page.waitForTimeout(1500).catch(() => undefined);
  },
});

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Khung chữ giữa đáy video cho chủ dự án đọc điều màn hình không hiện: log của worker, nội dung file tải về.
export async function note(page: Page, lines: string[], ms = 3000) {
  const html = `<div style="position:absolute;left:50%;bottom:56px;transform:translateX(-50%);max-width:92%;padding:10px 14px;border-radius:10px;background:rgba(0,0,0,.8);color:#fff;font:14px/1.5 system-ui,sans-serif;white-space:pre-wrap;word-break:break-word">${lines.map(escape).join("<br>")}</div>`;
  await page.screencast.showOverlay(html, { duration: ms });
}

export const chapter = (page: Page, title: string, description?: string) => page.screencast.showChapter(title, { description, duration: 1500 });

export async function login(page: Page, username: string, password = PASSWORD) {
  await page.goto(`${ADMIN}/login`);
  await page.getByLabel("Tài khoản").fill(username);
  await page.getByLabel("Mật khẩu", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

// Dev server biên dịch trang lần đầu: bấm trước lúc React gắn sự kiện thì nút không phản hồi.
export async function loginAs(page: Page, username: string, password = PASSWORD) {
  await login(page, username, password);
  await page.waitForURL(/\/(users|profile)$/);
  await page.waitForLoadState("networkidle");
}

export async function logout(page: Page) {
  await page.locator('button[aria-controls="account-menu"]').click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await page.waitForURL(/\/login$/);
}

export const sidebar = (page: Page) => page.getByRole("navigation", { name: "Điều hướng chính" });

export async function openMenu(page: Page, label: string, group?: string) {
  await openSidebarGroups(page);
  const nav = sidebar(page);
  const scope = group ? nav.getByRole("listitem").filter({ has: page.getByRole("button", { name: group }) }) : nav;
  // Mục Tin SMS lỗi kèm số tin lỗi sau tên, nên khớp phần đầu tên mục.
  await scope.getByRole("link", { name: new RegExp(`^${label}`) }).click();
  await page.waitForLoadState("networkidle");
}

export async function search(page: Page, placeholder: string, text: string) {
  const box = page.getByRole("search").getByPlaceholder(placeholder);
  await box.fill(text);
  await box.press("Enter");
  await page.waitForURL(/[?&]q=/);
  await page.waitForLoadState("networkidle");
}

type StudentInfo = { fullName: string; className: string; phone: string; parentPhone: string };
type StudentBank = { id: string; name: string; slots: { id: string; name: string }[] };
export type Student = { id: string; token: string; info: StudentInfo; banks: StudentBank[] };
export type Screen = { name: string; mimeType: string; buffer: Buffer };

const asFile = (screen?: Screen) => screen ?? { name: "anh.jpg", mimeType: "image/jpeg", buffer: readFileSync(PHOTO) };

// Phần học sinh của các flow hậu kiểm dựng qua API web học sinh: flow 4 đã quay trọn màn học sinh.
export async function apiStudent(page: Page, info: StudentInfo, bankNames: string[], opts: { screens?: Record<string, Screen>; submit?: boolean } = {}): Promise<Student> {
  const headers = { Origin: STUDENT };
  const created = await page.request.post(`${STUDENT}/api/customers`, { headers, data: { schoolId: E2E_STUDENT_SCHOOL_ID, ...info, consent: true, existingBankIds: [] } });
  expect(created.status()).toBe(201);
  const { id, token } = await created.json();
  const auth = { ...headers, Authorization: `Bearer ${token}` };
  const me = async () => (await page.request.get(`${STUDENT}/api/customers/me`, { headers: auth })).json();
  const eligible: { id: string; name: string }[] = (await me()).eligibleBanks;
  const bankIds = bankNames.map((name) => eligible.find((b) => b.name === name)!.id);
  expect((await page.request.post(`${STUDENT}/api/customers/me/banks`, { headers: auth, data: { bankIds } })).status()).toBe(204);
  const banks: StudentBank[] = (await me()).banks;
  if (opts.submit === false) return { id, token, info, banks };
  for (const bank of banks)
    for (const slot of bank.slots) {
      const res = await page.request.post(`${STUDENT}/api/customers/me/photos`, { headers: auth, multipart: { customerBankId: bank.id, slotId: slot.id, file: asFile(opts.screens?.[bank.name]) } });
      expect(res.status()).toBe(201);
    }
  expect((await page.request.post(`${STUDENT}/api/customers/me/submit`, { headers: auth })).ok()).toBe(true);
  return { id, token, info, banks };
}

// Máy của học sinh giữ trường và token trong localStorage: đặt sẵn để trang mở lại đúng hồ sơ đã gửi.
export async function useStudentDevice(page: Page, s: Student) {
  await page.addInitScript(
    ({ origin, store }) => {
      if (location.origin === origin) for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
    },
    { origin: STUDENT, store: { "mgi.schoolId": E2E_STUDENT_SCHOOL_ID, "mgi.customerId": s.id, "mgi.token": s.token } },
  );
}

export const bankOf = (s: Student, name: string) => s.banks.find((b) => b.name === name)!;

export async function apiReview(page: Page, customerBankId: string, result: "passed" | "failed", expected: "pending" | "failed" = "pending") {
  const res = await page.request.post(`${ADMIN}/api/admin/customer-banks/${customerBankId}/review`, { headers: { Origin: ADMIN }, data: { result, expected } });
  expect(res.ok()).toBe(true);
}

// Worker chạy một vòng và chỉ chạm hồ sơ của trường e2e, không chạm hồ sơ thật trong DB local.
const run = (args: string[], timeout = 60_000) => execFileSync("bun", ["--env-file=.env.local", ...args], { encoding: "utf8", timeout });
export const smsWorker = () => run(["scripts/sms-worker.ts", "--mot-vong", `--truong=${E2E_STUDENT_SCHOOL_ID}`]);
export const smsRefused = (phone: string, rounds: number) => run(["e2e/flows/sms-refused.ts", phone, String(rounds)]);
export const photoCheckWorker = () => run(["scripts/photo-check-worker.ts", "--mot-vong", `--truong=${E2E_STUDENT_SCHOOL_ID}`], 240_000);

export const logLines = (out: string, tag: string) => out.split("\n").filter((l) => l.includes(tag));
