import { describe, expect, test } from "bun:test";
import { contentTypeOf, fitWithin, shrink, TARGET_BYTES } from "../../src/lib/compressImage";

describe("cỡ ảnh sau khi nén", () => {
  test("cạnh dài tối đa 1600, giữ tỉ lệ", () => {
    expect(fitWithin(4032, 3024)).toEqual({ width: 1600, height: 1200 });
    expect(fitWithin(1170, 2532)).toEqual({ width: 739, height: 1600 });
  });
  test("ảnh nhỏ giữ nguyên cỡ", () => expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 }));
});

describe("nén tới dưới 300 KB", () => {
  test("dừng ở lần đầu đạt dưới 300 KB", async () => {
    const tries: string[] = [];
    const out = await shrink(async (scale, quality) => {
      tries.push(`${scale}:${quality}`);
      return { size: quality > 0.6 ? 500_000 : 250_000, scale, quality };
    });
    expect(out.size).toBeLessThanOrEqual(TARGET_BYTES);
    expect(tries).toEqual(["1:0.82", "1:0.7", "1:0.58"]);
  });

  test("hạ chất lượng không đủ thì thu nhỏ ảnh", async () => {
    const out = await shrink(async (scale, quality) => ({ size: scale >= 1 ? 900_000 : 200_000, scale, quality }));
    expect(out).toMatchObject({ size: 200_000, scale: 0.75, quality: 0.82 });
  });

  test("không bao giờ đạt thì trả bản nhỏ nhất đã thử", async () => {
    let calls = 0;
    const out = await shrink(async (scale, quality) => ({ size: 1_000_000 - ++calls, scale, quality }));
    expect(out.size).toBe(1_000_000 - calls);
    expect(calls).toBeLessThanOrEqual(16);
  });
});

describe("loại ảnh gửi lên khi trình duyệt không nén được", () => {
  test("đọc theo file.type, iPhone gửi HEIC không có type thì đọc theo đuôi", () => {
    expect(contentTypeOf({ type: "image/jpeg", name: "a.jpg" })).toBe("image/jpeg");
    expect(contentTypeOf({ type: "", name: "IMG_0001.HEIC" })).toBe("image/heic");
    expect(contentTypeOf({ type: "", name: "note.txt" })).toBeNull();
    expect(contentTypeOf({ type: "image/gif", name: "a.gif" })).toBeNull();
  });
});
