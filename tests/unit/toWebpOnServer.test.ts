import { describe, expect, test } from "bun:test";
import sharp from "sharp";
import { toHeic } from "../support/heic";
import { broken, HEIC_HEAD, JPEG_HEAD, PNG_HEAD, screenshot } from "../support/screenshot";
import { MAX_IMAGE_BYTES } from "../../src/lib/imageKey";
import { putImage } from "../../src/server/storage";
import { toWebpOnServer } from "../../src/server/toWebpOnServer";

const MAX_BYTES = 300 * 1024;

describe("đổi WebP lúc nhận", () => {
  test("PNG 2400x3200 thành WebP dưới 300 KB, cạnh dài 1600", async () => {
    const out = await toWebpOnServer(await screenshot(2400, 3200, "png"), "png");
    const meta = await sharp(out!).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 1200, 1600]);
    expect(out!.length).toBeLessThanOrEqual(MAX_BYTES);
  }, 30_000);

  test("WebP đã trong trần thì giữ nguyên", async () => {
    const webp = await screenshot(1200, 1600, "webp", 80);
    expect(webp.length).toBeLessThanOrEqual(MAX_BYTES);
    expect(await toWebpOnServer(webp, "webp")).toBeNull();
  });

  test("HEIC thành WebP", async () => {
    const heic = toHeic(await screenshot(1200, 1600, "png"));
    if (!heic) return;
    const meta = await sharp((await toWebpOnServer(heic, "heic"))!).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 1200, 1600]);
  }, 60_000);

  test("file hỏng mang chữ ký ảnh thì không đổi được, nơi gọi giữ bản gốc", async () => {
    expect(await toWebpOnServer(broken(PNG_HEAD), "png")).toBeNull();
    expect(await toWebpOnServer(broken(JPEG_HEAD), "jpg")).toBeNull();
    expect(await toWebpOnServer(broken(HEIC_HEAD), "heic")).toBeNull();
  });
});

describe("putImage từ chối trước khi ghi S3", () => {
  test("trần 20 MB như mgst-app", async () => {
    expect(MAX_IMAGE_BYTES).toBe(20 * 1024 * 1024);
    const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
    big.set(PNG_HEAD);
    expect(await putImage(big, "proofs")).toEqual({ ok: false, message: "Ảnh lớn hơn 20 MB." });
  });

  test("file không phải ảnh", async () => {
    expect(await putImage(new TextEncoder().encode("<html>not an image</html>"), "proofs")).toMatchObject({ ok: false });
  });

  test("ảnh mẫu HEIC không đổi được thì từ chối: Chrome và Android không hiện được HEIC", async () => {
    expect(await putImage(broken(HEIC_HEAD), "samples")).toMatchObject({ ok: false });
  });
});
