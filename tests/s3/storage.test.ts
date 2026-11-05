import { afterAll, describe, expect, test } from "bun:test";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import sharp from "sharp";
import { toHeic } from "../support/heic";
import { broken, JPEG_HEAD, screenshot } from "../support/screenshot";
import { deleteImage, newKey, presignGet, putImage, readImage } from "../../src/server/storage";

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

test("bucket không nhận PUT không ký: chỉ máy chủ ghi được ảnh", async () => {
  const key = newKey("proofs", "png");
  const url = new URL(await presignGet(key));
  url.search = "";
  const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: new Blob([PNG_1X1]) });
  expect(res.status).toBe(403);
  expect(await readImage(key)).toBeNull();
});

test("link xem ảnh trả Content-Type theo đuôi khoá, không theo loại lúc ghi", async () => {
  const { S3_ENDPOINT, S3_REGION, S3_BUCKET, S3_ACCESS_KEY_ID, S3_SECRET_ACCESS_KEY } = process.env;
  const s3 = new S3Client({ region: S3_REGION, endpoint: S3_ENDPOINT, forcePathStyle: true, credentials: { accessKeyId: S3_ACCESS_KEY_ID!, secretAccessKey: S3_SECRET_ACCESS_KEY! } });
  const key = newKey("proofs", "webp");
  written.push(key);
  await s3.send(new PutObjectCommand({ Bucket: S3_BUCKET, Key: key, Body: new TextEncoder().encode("<script>alert(1)</script>"), ContentType: "text/html" }));
  const res = await fetch(await presignGet(key));
  expect(res.headers.get("content-type")).toBe("image/webp");
  await res.arrayBuffer();
});
