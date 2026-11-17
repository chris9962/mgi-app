import { dismissSend, sendDialog } from "./edge-student-support";
import { randomBytes } from "node:crypto";
import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";
import { BANK, NAME, SCHOOL, SLOT } from "../scripts/e2e-data-student";
import { PHONE, PHOTO, apiCreate, apiPhotos, apiPick, device, info, onDevice, withEdgeData, type ApiStudent } from "./edge-student-support";

test.use(PHONE);
withEdgeData();

const MAIN = "Ảnh màn hình chính";
const BANK_NAME_P1 = NAME.p1;
const BANK_NAME_P3 = NAME.p3;
const TRANSFER = "Ảnh chuyển khoản";

// Mỗi ca một học sinh đã giữ chỗ P1 (2 khung) và P3 (1 khung), đang ở tab P1 của B3.
async function atB3(page: Page, request: import("@playwright/test").APIRequestContext, name: string): Promise<ApiStudent> {
  const s = await apiCreate(request, SCHOOL.photo, info(name));
  await apiPick(request, s, [BANK.p1, BANK.p3]);
  await onDevice(page, device(SCHOOL.photo, s));
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Mở tài khoản" })).toBeVisible();
  return s;
}

const slotItem = (page: Page, name: string) => page.getByRole("tabpanel").getByRole("listitem").filter({ hasText: name });

function countUploads(page: Page) {
  const seen = { n: 0 };
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/api/customers/me/photos") seen.n += 1;
  });
  return seen;
}

async function pick(page: Page, slot: string, file: string | { name: string; mimeType: string; buffer: Buffer }) {
  await page.getByRole("tabpanel").getByLabel(`${slot}: chọn ảnh`).setInputFiles(file);
}

test("E1 file văn bản đổi đuôi .jpg: báo chỉ nhận ảnh, khung vẫn trống", async ({ page, request }) => {
  await atB3(page, request, "Ảnh Giả Đuôi");
  await pick(page, MAIN, { name: "anh.jpg", mimeType: "image/jpeg", buffer: Buffer.from("đây không phải ảnh, chỉ là chữ") });
  await expect(slotItem(page, MAIN).getByRole("alert")).toHaveText("Chỉ nhận ảnh jpg, png, webp hoặc heic.");
  await expect(page.getByRole("tabpanel").getByLabel(`${MAIN}: chọn ảnh`)).toBeEnabled();
});

test("E2 file .txt: báo không mở được ảnh, không gửi lên máy chủ", async ({ page, request }) => {
  await atB3(page, request, "Tệp Chữ");
  const uploads = countUploads(page);
  await pick(page, MAIN, { name: "ghi-chu.txt", mimeType: "text/plain", buffer: Buffer.from("ghi chú") });
  await expect(slotItem(page, MAIN).getByRole("alert")).toHaveText("Không mở được ảnh này. Chọn ảnh khác.");
  expect(uploads.n).toBe(0);
});

test("E3 file 0 byte: báo file rỗng như mgst-app, không báo Chọn ảnh", async ({ page, request }) => {
  await atB3(page, request, "Tệp Rỗng");
  await pick(page, MAIN, { name: "anh.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(0) });
  await expect(slotItem(page, MAIN).getByRole("alert")).toHaveText("File rỗng.");
});

test("E4 file HEIC 21 MB trình duyệt không mở được: báo lớn hơn 20 MB ngay ở máy, không gửi lên máy chủ", async ({ page, request }) => {
  await atB3(page, request, "Ảnh Quá Nặng");
  const uploads = countUploads(page);
  await pick(page, MAIN, { name: "IMG_0001.HEIC", mimeType: "image/heic", buffer: randomBytes(21 * 1024 * 1024) });
  await expect(slotItem(page, MAIN).getByRole("alert")).toHaveText("Ảnh lớn hơn 20 MB.");
  expect(uploads.n).toBe(0);
});

test("E5 ảnh HEIC thật mà Chrome không mở được: gửi bản gốc, máy chủ đổi WebP, khung ghi Đã gửi", async ({ page, request }) => {
  const s = await atB3(page, request, "Ảnh Máy Android");
  await pick(page, MAIN, { name: "IMG_0002.HEIC", mimeType: "image/heic", buffer: readFileSync("tests/fixtures/heic-320x240.heic") });
  await expect(page.getByRole("tabpanel").getByLabel(`${MAIN}: chọn lại`)).toBeAttached({ timeout: 30_000 });
  await expect(slotItem(page, MAIN).getByText("Đã gửi")).toBeVisible();
  const photo = (await s.me()).banks[0].slots[0].photo!;
  expect(new URL(photo.url).pathname).toMatch(/\.webp$/);
});

test("E6, E7 ảnh JPEG 6000x8000 và ảnh PNG 1x1: gửi được, ảnh lớn được nén dưới 300 KB", async ({ page, request }) => {
  const s = await atB3(page, request, "Ảnh Rất Lớn Rất Nhỏ");
  const big = await sharp({ create: { width: 6000, height: 8000, channels: 3, background: { r: 30, g: 120, b: 200 } } }).jpeg({ quality: 90 }).toBuffer();
  const tiny = await sharp({ create: { width: 1, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } } }).png().toBuffer();
  await pick(page, MAIN, { name: "lon.jpg", mimeType: "image/jpeg", buffer: big });
  await expect(page.getByRole("tabpanel").getByLabel(`${MAIN}: chọn lại`)).toBeAttached({ timeout: 60_000 });
  await pick(page, TRANSFER, { name: "nho.png", mimeType: "image/png", buffer: tiny });
  await expect(page.getByRole("tabpanel").getByLabel(`${TRANSFER}: chọn lại`)).toBeAttached({ timeout: 30_000 });
  const [main, transfer] = (await s.me()).banks[0].slots;
  expect(main.photo!.sizeBytes).toBeLessThanOrEqual(300 * 1024);
  expect(transfer.photo!.sizeBytes).toBeGreaterThan(0);
});

test("E8 đang tải ảnh ở một khung: ô chọn của khung đó khoá, khung khác vẫn tải được, hộp hỏi đã hoàn thành chỉ mở khi xong", async ({ page, request }) => {
  const s = await atB3(page, request, "Hai Khung Cùng Lúc");
  await apiPhotos(request, s, [SLOT.p1Main, SLOT.p1Transfer]);
  let release = () => {};
  const gate = new Promise<void>((resolve) => (release = resolve));
  let first = true;
  await page.route("**/api/customers/me/photos", async (route) => {
    if (first) {
      first = false;
      await gate;
    }
    await route.continue();
  });
  await pick(page, MAIN, PHOTO);
  await expect(slotItem(page, MAIN).getByText("Đang tải ảnh")).toBeVisible();
  await expect(page.getByRole("tabpanel").getByLabel(`${MAIN}: chọn ảnh`)).toBeDisabled();
  await pick(page, TRANSFER, PHOTO);
  await expect(page.getByRole("tabpanel").getByLabel(`${TRANSFER}: chọn lại`)).toBeAttached({ timeout: 30_000 });
  await expect(slotItem(page, MAIN).getByText("Đang tải ảnh")).toBeVisible();
  // P3 đã đủ ảnh từ API nên lượt tải lại đầu tiên hỏi gửi P3; P1 còn khung đang tải thì chưa hỏi.
  await expect(sendDialog(page)).toContainText(`Đã hoàn thành ${BANK_NAME_P3}?`);
  await dismissSend(page);
  release();
  await expect(page.getByRole("tabpanel").getByLabel(`${MAIN}: chọn lại`)).toBeAttached({ timeout: 30_000 });
  await expect(sendDialog(page)).toContainText(`Đã hoàn thành ${BANK_NAME_P1}?`);
});
