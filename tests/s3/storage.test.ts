import { expect, test } from "bun:test";
import { copyImage, deleteImage, headSize, newKey, presignGet, presignPut, putImage } from "../../src/server/storage";

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

const guard = () => {
  if (process.env.S3_BUCKET === "mgst-images") throw new Error("Không chạy test trên bucket production của mgst-app.");
};
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
