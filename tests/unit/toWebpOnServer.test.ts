import { describe, expect, test } from "bun:test";
import { deflateSync } from "node:zlib";
import sharp from "sharp";
import { heicFixture } from "../support/heic";
import { broken, HEIC_HEAD, JPEG_HEAD, PNG_HEAD, screenshot } from "../support/screenshot";
import { MAX_IMAGE_BYTES } from "../../src/lib/imageKey";
import { putImage } from "../../src/server/storage";
import { heicFits, heicPixels, heicToJpeg } from "../../src/server/heic";
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
    const meta = await sharp((await toWebpOnServer(heicFixture("heic-320x240.heic"), "heic"))!).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 320, 240]);
  });

  test("file hỏng mang chữ ký ảnh thì không đổi được, nơi gọi giữ bản gốc", async () => {
    expect(await toWebpOnServer(broken(PNG_HEAD), "png")).toBeNull();
    expect(await toWebpOnServer(broken(JPEG_HEAD), "jpg")).toBeNull();
    expect(await toWebpOnServer(broken(HEIC_HEAD), "heic")).toBeNull();
  });
});

// PNG chỉ có phần đầu khai kích thước, dữ liệu điểm ảnh gần như rỗng: vài trăm byte mà giải mã ra hàng trăm MB.
function pngClaiming(width: number, height: number): Uint8Array {
  const chunk = (type: string, data: Uint8Array) => {
    const body = new Uint8Array([...new TextEncoder().encode(type), ...data]);
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length);
    out.set(body, 4);
    view.setUint32(8 + data.length, Bun.hash.crc32(body));
    return out;
  };
  const ihdr = new Uint8Array(13);
  new DataView(ihdr.buffer).setUint32(0, width);
  new DataView(ihdr.buffer).setUint32(4, height);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return new Uint8Array([...PNG_HEAD, ...chunk("IHDR", ihdr), ...chunk("IDAT", new Uint8Array(deflateSync(new Uint8Array(1000)))), ...chunk("IEND", new Uint8Array())]);
}

// Ghi kích thước khác vào mọi hộp ispe: thử ngưỡng của trần mà không phải dựng ảnh thật cỡ đó.
function withSize(heic: Uint8Array, width: number, height: number): Uint8Array {
  const out = new Uint8Array(heic);
  const view = new DataView(out.buffer);
  for (let i = 4; i + 16 <= out.length; i += 1) {
    if (String.fromCharCode(...out.subarray(i, i + 4)) !== "ispe" || view.getUint32(i - 4) !== 20) continue;
    view.setUint32(i + 8, width);
    view.setUint32(i + 12, height);
  }
  return out;
}

describe("trần điểm ảnh: route nộp ảnh mở cho học sinh không đăng nhập", () => {
  test("đọc số điểm ảnh của HEIC từ hộp ispe, không giải mã", () => {
    expect(heicPixels(heicFixture("heic-320x240.heic"))).toBe(320 * 240);
    expect(heicPixels(heicFixture("heic-8192x8192-phang.heic"))).toBe(8192 * 8192);
    expect(heicPixels(broken(HEIC_HEAD))).toBeNull();
  });

  test("PNG khai 110 MP không bị giải mã: trả null ngay, nơi gọi giữ bản gốc", async () => {
    const started = Date.now();
    expect(await toWebpOnServer(pngClaiming(11_000, 10_000), "png")).toBeNull();
    expect(Date.now() - started).toBeLessThan(1500);
  }, 120_000);

  test("trần HEIC 64 MP: ảnh 50 MP của máy Android (8160x6144) vẫn đổi; ảnh 8192x8192 hoặc thiếu hộp ispe thì không", () => {
    expect(heicFits(heicFixture("heic-320x240.heic"))).toBe(true);
    expect(heicFits(withSize(heicFixture("heic-320x240.heic"), 8160, 6144))).toBe(true);
    expect(heicFits(heicFixture("heic-8192x8192-phang.heic"))).toBe(false);
    expect(heicFits(broken(HEIC_HEAD))).toBe(false);
  });

  test("HEIC 8192x8192 nền phẳng (31 KB, 67 MP) vượt trần: không giải mã, trả null ngay, nơi gọi giữ bản gốc", async () => {
    const started = Date.now();
    expect(await toWebpOnServer(heicFixture("heic-8192x8192-phang.heic"), "heic")).toBeNull();
    expect(Date.now() - started).toBeLessThan(1000);
  }, 120_000);

  test("hai lượt đổi HEIC cùng lúc chạy lần lượt: lượt sau chờ lượt trước xong, lượt lỗi không chặn hàng", async () => {
    const events: string[] = [];
    const decoder = (name: string, fails = false) =>
      (async () => {
        events.push(`${name} bắt đầu`);
        await Bun.sleep(30);
        events.push(`${name} xong`);
        if (fails) throw new Error("hỏng");
        return new ArrayBuffer(1);
      }) as unknown as Parameters<typeof heicToJpeg>[1];
    const bytes = heicFixture("heic-320x240.heic");
    const results = await Promise.allSettled([heicToJpeg(bytes, decoder("A", true)), heicToJpeg(bytes, decoder("B")), heicToJpeg(bytes, decoder("C"))]);
    expect(results.map((r) => r.status)).toEqual(["rejected", "fulfilled", "fulfilled"]);
    expect(events).toEqual(["A bắt đầu", "A xong", "B bắt đầu", "B xong", "C bắt đầu", "C xong"]);
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
