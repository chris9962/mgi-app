import { expect, test } from "bun:test";
import { deleteImage, headSize, newKey, presignGet, presignPut, putImage } from "../../src/server/storage";

// Chạy trên bucket dev mgi-bank-dev: ghi một ảnh png 1x1, đọc lại qua presigned URL rồi xoá.
const PNG_1X1 = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64"));

test("ghi, đọc qua presigned URL, xoá ảnh trên S3", async () => {
  if (process.env.S3_BUCKET === "mgst-images") throw new Error("Không chạy test trên bucket production của mgst-app.");
  const put = await putImage(PNG_1X1, "samples");
  if (!put.ok) throw new Error(put.message);
  const res = await fetch(await presignGet(put.key));
  expect(res.status).toBe(200);
  expect(new Uint8Array(await res.arrayBuffer())).toEqual(PNG_1X1);
  await deleteImage(put.key);
  expect((await fetch(await presignGet(put.key))).status).toBe(404);
});

test("file không phải ảnh bị từ chối", async () => {
  const r = await putImage(new TextEncoder().encode("not an image"), "samples");
  expect(r.ok).toBe(false);
});

test("presigned PUT: điện thoại tải thẳng lên S3, máy chủ đọc dung lượng bằng HeadObject", async () => {
  if (process.env.S3_BUCKET === "mgst-images") throw new Error("Không chạy test trên bucket production của mgst-app.");
  const key = newKey("proofs", "png");
  expect(await headSize(key)).toBeNull();
  const url = await presignPut(key, "image/png");
  const res = await fetch(url, { method: "PUT", headers: { "Content-Type": "image/png" }, body: PNG_1X1 });
  expect(res.status).toBe(200);
  expect(await headSize(key)).toBe(PNG_1X1.length);
  await deleteImage(key);
  expect(await headSize(key)).toBeNull();
});
