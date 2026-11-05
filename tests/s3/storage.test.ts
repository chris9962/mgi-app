import { afterAll, describe, expect, test } from "bun:test";
import sharp from "sharp";
import { toHeic } from "../support/heic";
import { broken, JPEG_HEAD, screenshot } from "../support/screenshot";
import { copyImage, deleteImage, headSize, newKey, presignGet, presignPut, putImage, readImage } from "../../src/server/storage";

// Chạy trên bucket dev mgi-bank-dev: mọi object test ghi đều xoá ở afterAll.
if (process.env.S3_BUCKET === "mgst-images") throw new Error("Không chạy test trên bucket production của mgst-app.");
const PNG_1X1 = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));
const written: string[] = [];
afterAll(async () => {
  for (const key of written) await deleteImage(key).catch(() => undefined);
});

async function stored(bytes: Uint8Array, folder: "samples" | "proofs") {
  const r = await putImage(bytes, folder);
  if (!r.ok) throw new Error(r.message);
  written.push(r.key);
  return { ...r, body: (await readImage(r.key))! };
}

test("ghi, đọc qua presigned URL, xoá ảnh trên S3", async () => {
  const webp = await screenshot(300, 400, "webp", 80);
  const put = await putImage(webp, "samples");
  if (!put.ok) throw new Error(put.message);
  const res = await fetch(await presignGet(put.key));
  expect(res.status).toBe(200);
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(webp);
  await deleteImage(put.key);
  expect((await fetch(await presignGet(put.key))).status).toBe(404);
});

describe("putImage đổi WebP lúc nhận", () => {
  test("PNG lớn ghi thành WebP dưới 300 KB, cạnh dài 1600; dung lượng trả về là của object đã ghi", async () => {
    const r = await stored(await screenshot(2400, 3200, "png"), "proofs");
    expect(r.key).toMatch(/^proofs\/.+\.webp$/);
    const meta = await sharp(r.body).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 1200, 1600]);
    expect(r.size).toBe(r.body.length);
    expect(r.size).toBeLessThanOrEqual(300 * 1024);
  }, 30_000);

  test("WebP nhỏ giữ nguyên từng byte", async () => {
    const webp = await screenshot(1200, 1600, "webp", 80);
    const r = await stored(webp, "proofs");
    expect(r.key.endsWith(".webp")).toBe(true);
    expect(r.body).toEqual(webp);
    expect(r.size).toBe(webp.length);
  });

  test("HEIC ghi thành WebP, cả ảnh học sinh lẫn ảnh mẫu", async () => {
    const heic = toHeic(await screenshot(1200, 1600, "png"));
    if (!heic) return;
    for (const folder of ["proofs", "samples"] as const) {
      const r = await stored(heic, folder);
      expect(r.key).toMatch(new RegExp(`^${folder}/.+\\.webp$`));
      expect((await sharp(r.body).metadata()).format).toBe("webp");
    }
  }, 60_000);

  test("file hỏng mang chữ ký ảnh thì ghi nguyên bản gốc với đuôi theo chữ ký", async () => {
    const bad = broken(JPEG_HEAD);
    const r = await stored(bad, "proofs");
    expect(r.key).toMatch(/^proofs\/.+\.jpg$/);
    expect(r.body).toEqual(bad);
    expect(r.size).toBe(bad.length);
  });
});

test("file không phải ảnh bị từ chối", async () => {
  const r = await putImage(new TextEncoder().encode("not an image"), "samples");
  expect(r.ok).toBe(false);
});

const guard = () => undefined;
const put = (url: string, type: string, body: Uint8Array) => fetch(url, { method: "PUT", headers: { "Content-Type": type }, body: new Blob([new Uint8Array(body)]) });

test("presigned PUT: đúng loại và đúng dung lượng đã ký thì S3 nhận, máy chủ đọc dung lượng bằng HeadObject", async () => {
  guard();
  const key = newKey("uploads", "png");
  expect(await headSize(key)).toBeNull();
  expect((await put(await presignPut(key, "image/png", PNG_1X1.length), "image/png", PNG_1X1)).status).toBe(200);
  expect(await headSize(key)).toBe(PNG_1X1.length);
  await deleteImage(key);
  expect(await headSize(key)).toBeNull();
});

test("presigned PUT: sai loại ảnh hoặc body lớn hơn dung lượng đã ký thì S3 từ chối", async () => {
  guard();
  const key = newKey("uploads", "png");
  const url = await presignPut(key, "image/png", PNG_1X1.length);
  expect((await put(url, "text/html", PNG_1X1)).status).toBe(403);
  const bigger = new Uint8Array([...PNG_1X1, 0, 0, 0, 0]);
  expect((await put(url, "image/png", bigger)).status).toBeGreaterThanOrEqual(400);
  expect(await headSize(key)).toBeNull();
});

test("ảnh đã ghi nằm ở khoá do máy chủ chọn: link PUT của khoá tải lên không ghi đè được khoá đó", async () => {
  guard();
  const upload = newKey("uploads", "png");
  const url = await presignPut(upload, "image/png", PNG_1X1.length);
  expect((await put(url, "image/png", PNG_1X1)).status).toBe(200);
  const final = newKey("proofs", "png");
  await copyImage(upload, final);
  await deleteImage(upload);
  const forged = new URL(url);
  forged.pathname = forged.pathname.replace(upload, final);
  expect((await put(forged.toString(), "image/png", PNG_1X1)).status).toBe(403);
  const unsigned = new URL(url);
  unsigned.pathname = forged.pathname;
  unsigned.search = "";
  expect((await put(unsigned.toString(), "image/png", PNG_1X1)).status).toBe(403);
  expect(await headSize(final)).toBe(PNG_1X1.length);
  await deleteImage(final);
});

test("link xem ảnh trả Content-Type theo đuôi khoá, không theo loại lúc tải lên", async () => {
  guard();
  const key = newKey("uploads", "webp");
  const html = new TextEncoder().encode("<script>alert(1)</script>");
  expect((await put(await presignPut(key, "text/html", html.length), "text/html", html)).status).toBe(200);
  const res = await fetch(await presignGet(key));
  expect(res.headers.get("content-type")).toBe("image/webp");
  await res.arrayBuffer();
  await deleteImage(key);
});
