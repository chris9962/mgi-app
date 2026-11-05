import { describe, expect, test } from "bun:test";
import { imageExtOf, isValidKey, newKey } from "../../src/server/storage";

const UUID = "3f2b9c1e-8a4d-4f6b-9c2e-1a2b3c4d5e6f";

describe("khoá ảnh", () => {
  test("khoá đúng dạng thì nhận", () => {
    expect(isValidKey(`samples/2026-11-05/${UUID}.jpg`)).toBe(true);
    expect(isValidKey(`qr/2026-11-05/${UUID}.png`)).toBe(true);
  });

  test("khoá lạ thì từ chối", () => {
    for (const k of ["../.env.local", "javascript:alert(1)", "samples/x.jpg", `other/2026-11-05/${UUID}.jpg`, `samples/2026-11-05/${UUID}.exe`, `samples/2026-11-05/../${UUID}.jpg`]) {
      expect(isValidKey(k)).toBe(false);
    }
  });

  test("newKey sinh khoá hợp lệ", () => {
    expect(isValidKey(newKey("qr", "png"))).toBe(true);
  });
});

describe("chữ ký ảnh", () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(16).fill(0)]);
  test("nhận ra jpg, png, webp, heic", () => {
    expect(imageExtOf(bytes(0xff, 0xd8, 0xff))).toBe("jpg");
    expect(imageExtOf(bytes(0x89, 0x50, 0x4e, 0x47))).toBe("png");
    expect(imageExtOf(bytes(0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50))).toBe("webp");
    expect(imageExtOf(bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63))).toBe("heic");
  });
  test("file chữ và video mp4 không phải ảnh", () => {
    expect(imageExtOf(new TextEncoder().encode("hello world, not an image"))).toBeNull();
    expect(imageExtOf(bytes(0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x69, 0x73, 0x6f, 0x6d))).toBeNull();
  });
});
