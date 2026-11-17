import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, type APIRequestContext, type Locator, type Page } from "@playwright/test";
import QRCode from "qrcode";

export const STUDENT = "http://bank.localhost:3100";
export const ORIGIN = { Origin: STUDENT };
export const PHOTO = "public/brand/photo.jpg";
export const PHONE = { baseURL: STUDENT, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true };

// Trạng thái học sinh không tự tạo được qua API (giờ gửi, voucher, kết quả hậu kiểm, đóng trường) ghi bằng script của nhóm A.
export const dbOp = (...args: string[]) => execFileSync("bun", ["--env-file=.env.local", "scripts/e2e-seed-student.ts", ...args], { encoding: "utf8", timeout: 60_000 });

// Dữ liệu tên rất dài chỉ sống trong lúc file chạy: trang quản lý của nhóm khác không thấy nó khi đo cuộn ngang.
export function withEdgeData() {
  test.beforeAll(() => void dbOp("seed"));
  test.afterAll(() => void dbOp("clean"));
}

export type Info = { fullName: string; className: string; parentPhone: string };

let phoneSeq = 0;
// Mỗi hồ sơ một SĐT phụ huynh riêng để tìm lại được.
export function info(fullName: string, extra: Partial<Info> = {}): Info {
  phoneSeq += 1;
  const n = String((Date.now() % 100000) * 10 + (phoneSeq % 10)).padStart(6, "0").slice(-6);
  return { fullName, className: "10A1", parentPhone: `0922${n}`, ...extra };
}

export type ApiStudent = { id: string; token: string; auth: Record<string, string>; me: () => Promise<StudentMe> };
type StudentMe = {
  customer: { status: string; fullName: string; className: string };
  eligibleBanks: { id: string; name: string }[];
  banks: { id: string; bankId: string; name: string; status: string; slots: { id: string; name: string; photo: { url: string; sizeBytes: number } | null }[] }[];
  pviAppUrl: string;
  zaloUrl: string;
};

export async function apiCreate(request: APIRequestContext, schoolId: string, who: Info, existingBankIds: string[] = []): Promise<ApiStudent> {
  const res = await request.post(`${STUDENT}/api/customers`, { headers: ORIGIN, data: { schoolId, ...who, consent: true, existingBankIds } });
  expect(res.status(), await res.text()).toBe(201);
  const { id, token } = await res.json();
  const auth = { ...ORIGIN, Authorization: `Bearer ${token}` };
  const me = async () => (await request.get(`${STUDENT}/api/customers/me`, { headers: auth })).json();
  return { id, token, auth, me };
}

export async function apiPick(request: APIRequestContext, s: ApiStudent, bankIds: string[]) {
  const res = await request.post(`${STUDENT}/api/customers/me/banks`, { headers: s.auth, data: { bankIds } });
  expect(res.status(), await res.text()).toBe(204);
}

export const photoFile = () => ({ name: "anh.jpg", mimeType: "image/jpeg", buffer: readFileSync(PHOTO) });

export async function apiPhotos(request: APIRequestContext, s: ApiStudent, skip: string[] = []) {
  for (const bank of (await s.me()).banks)
    for (const slot of bank.slots) {
      if (skip.includes(slot.id)) continue;
      const res = await request.post(`${STUDENT}/api/customers/me/photos`, { headers: s.auth, multipart: { customerBankId: bank.id, slotId: slot.id, file: photoFile() } });
      expect(res.status(), await res.text()).toBe(201);
    }
}

export async function apiSubmit(request: APIRequestContext, s: ApiStudent) {
  const res = await request.post(`${STUDENT}/api/customers/me/submit`, { headers: s.auth });
  expect(res.status(), await res.text()).toBe(204);
}

let deviceSeq = 0;
// Máy của học sinh giữ trường và token trong localStorage: đặt một lần ở lần mở trang kế tiếp, tải lại thì giữ thứ web đã ghi.
export async function onDevice(page: Page, store: Record<string, string>) {
  deviceSeq += 1;
  await page.addInitScript(
    ({ origin, store, flag }) => {
      if (location.origin !== origin || sessionStorage.getItem(flag)) return;
      sessionStorage.setItem(flag, "1");
      for (const k of ["mgi.schoolId", "mgi.customerId", "mgi.token"]) localStorage.removeItem(k);
      for (const [k, v] of Object.entries(store)) localStorage.setItem(k, v);
    },
    { origin: STUDENT, store, flag: `zz-e2e-device-${deviceSeq}` },
  );
}

export const device = (schoolId: string, s?: ApiStudent) => ({ "mgi.schoolId": schoolId, ...(s ? { "mgi.customerId": s.id, "mgi.token": s.token } : {}) });

export async function fillInfo(page: Page, who: Info) {
  await page.getByLabel("Họ và tên", { exact: true }).fill(who.fullName);
  await page.getByLabel("Lớp").fill(who.className);
  await page.getByLabel("SĐT phụ huynh").fill(who.parentPhone);
  await page.getByRole("checkbox", { name: "Đồng ý" }).check();
}

// Màn mới trượt vào từ mép (anim-step, anim-rise): đo hình học lúc đang chuyển động thì phần tử còn lệch vài px.
export const settled = (page: Page) => page.evaluate(() => Promise.all(document.getAnimations().map((a) => a.finished.catch(() => undefined))).then(() => undefined));

export async function expectNoSideScroll(page: Page) {
  await settled(page);
  const { scroll, client } = await page.evaluate(() => ({ scroll: document.documentElement.scrollWidth, client: document.documentElement.clientWidth }));
  expect(scroll, "trang cuộn ngang").toBeLessThanOrEqual(client);
}

// Phần tử phải nằm trọn trong bề ngang màn hình: chữ dài không đẩy nút hay nhãn ra ngoài.
export async function expectInsideScreen(page: Page, selector: ReturnType<Page["locator"]>) {
  await settled(page);
  const width = page.viewportSize()!.width;
  for (const box of await selector.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { left: number; right: number })))
    expect(box.right, "phần tử tràn mép phải").toBeLessThanOrEqual(width);
}

// Phần tử con phải nằm trọn trong khung của chính nó: đo với khung cha, không đo với màn hình.
export async function expectInsideBox(boxes: Locator, childSelector: string) {
  await settled(boxes.page());
  const gaps = await boxes.evaluateAll(
    (els, selector) =>
      els.flatMap((el) => {
        const outer = el.getBoundingClientRect();
        return [...el.querySelectorAll(selector)].map((child) => {
          const inner = child.getBoundingClientRect();
          return { left: inner.left - outer.left, right: outer.right - inner.right, top: inner.top - outer.top, bottom: outer.bottom - inner.bottom };
        });
      }),
    childSelector,
  );
  expect(gaps.length, "không thấy phần tử con").toBeGreaterThan(0);
  for (const gap of gaps) for (const [side, value] of Object.entries(gap)) expect(value, `tràn cạnh ${side} của khung`).toBeGreaterThanOrEqual(-0.5);
}

// Ô tick, vòng tròn đánh dấu phải giữ kích thước khi chữ bên cạnh dài: phần tử flex thiếu flex-none bị bóp hẹp.
export async function expectBoxSize(items: Locator, width: number, height: number) {
  await settled(items.page());
  const boxes = await items.evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as { width: number; height: number }));
  expect(boxes.length, "không thấy phần tử nào").toBeGreaterThan(0);
  for (const box of boxes) {
    expect(box.width, "bề ngang").toBeCloseTo(width, 0);
    expect(box.height, "bề cao").toBeCloseTo(height, 0);
  }
}

// Số dòng của chữ nằm thẳng trong phần tử, không tính chữ của thẻ con.
export const textLines = (el: Locator) =>
  el.evaluate((node) => {
    const range = document.createRange();
    const tops = new Set<number>();
    for (const child of node.childNodes) {
      if (child.nodeType !== Node.TEXT_NODE || !child.textContent?.trim()) continue;
      range.selectNodeContents(child);
      for (const rect of range.getClientRects()) tops.add(Math.round(rect.top));
    }
    return tops.size;
  });

// Link Zalo mặc định rỗng nên khối Zalo không hiện: chèn link vào hồ sơ trả về thay vì ghi Cài đặt thật của DB local.
export async function withZalo(page: Page, url: string) {
  await page.route("**/api/customers/me", async (route) => {
    const res = await route.fetch();
    if (!res.ok()) return route.fulfill({ response: res });
    await route.fulfill({ response: res, json: { ...(await res.json()), zaloUrl: url } });
  });
}

// Hộp alert của trình duyệt chỉ hiện khi chữ người dùng nhập bị chạy như mã.
export function watchDialogs(page: Page): string[] {
  const seen: string[] = [];
  page.on("dialog", (d) => {
    seen.push(`${d.type()}: ${d.message()}`);
    void d.dismiss();
  });
  return seen;
}

export async function fromDevice(page: Page): Promise<ApiStudent> {
  const { id, token } = await page.evaluate(() => ({ id: localStorage.getItem("mgi.customerId")!, token: localStorage.getItem("mgi.token")! }));
  const auth = { ...ORIGIN, Authorization: `Bearer ${token}` };
  return { id, token, auth, me: async () => (await page.request.get(`${STUDENT}/api/customers/me`, { headers: auth })).json() };
}

// Camera giả của Chromium phát file y4m: một khung xám 640x480 có QR ở giữa, phát lặp lại.
export function qrCamera(text: string): string {
  const { modules } = QRCode.create(text, { errorCorrectionLevel: "M" });
  const [w, h, cell] = [640, 480, 8];
  const size = (modules.size + 8) * cell;
  const [x0, y0] = [(w - size) / 2, (h - size) / 2];
  const luma = Buffer.alloc(w * h, 255);
  for (let y = 0; y < modules.size; y++)
    for (let x = 0; x < modules.size; x++) {
      if (!modules.get(y, x)) continue;
      for (let dy = 0; dy < cell; dy++) luma.fill(0, (y0 + (y + 4) * cell + dy) * w + x0 + (x + 4) * cell, (y0 + (y + 4) * cell + dy) * w + x0 + (x + 5) * cell);
    }
  const frame = Buffer.concat([Buffer.from("FRAME\n"), luma, Buffer.alloc(w * h / 2, 128)]);
  const file = join(tmpdir(), `zz-e2e-qr-${createHash("sha1").update(text).digest("hex").slice(0, 10)}.y4m`);
  writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${w} H${h} F5:1 Ip A1:1 C420jpeg\n`), frame, frame]));
  return file;
}

export const cameraOptions = (file: string) => ({
  launchOptions: { args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream", `--use-file-for-fake-video-capture=${file}`] },
  permissions: ["camera"],
});


// Gửi kiểm tra từng ngân hàng (2026-11-17): hộp "Đã hoàn thành ...?" tự mở khi ngân hàng vừa đủ ảnh, khi vào màn còn ngân hàng đủ ảnh chưa gửi, và sau khi gửi một ngân hàng mà ngân hàng kế đã đủ ảnh.
export const sendDialog = (page: Page) => page.getByRole("dialog", { name: "Gửi kiểm tra" });
// Hồ sơ dựng qua API đã đủ ảnh một ngân hàng thì vào màn là hộp hỏi gửi mở: test không kiểm việc gửi thì đóng để bấm tiếp được.
export async function dismissSend(page: Page) {
  await sendDialog(page).waitFor({ state: "visible", timeout: 5_000 }).catch(() => {});
  if (await sendDialog(page).count()) await sendDialog(page).getByRole("button", { name: "Huỷ" }).click();
  await expect(sendDialog(page)).toHaveCount(0);
}
export async function confirmSend(page: Page) {
  await sendDialog(page).getByRole("button", { name: "Gửi kiểm tra" }).click();
  await expect(sendDialog(page)).toHaveCount(0);
}
// Gửi xong ngân hàng thứ hai thì hộp quà 20.000 đồng mở: test không kiểm quà thì đóng để bấm tiếp được.
export async function dismissGift(page: Page) {
  const gift = page.getByRole("dialog", { name: /Nhận 20\.000/ });
  await gift.waitFor({ state: "visible", timeout: 10_000 }).catch(() => {});
  if (await gift.count()) await gift.getByRole("button", { name: "Để sau" }).click();
  await expect(gift).toHaveCount(0);
}

export const PHONE_ERROR = "SĐT phải có 10 số, bắt đầu bằng 0.";
export const NETWORK = "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.";
export const LATER = "Thử lại sau ít phút.";
