import { describe, expect, test } from "bun:test";
import { deleteImage, imageExtOf, isValidKey, newKey, readImage, writeImage } from "../../src/server/storage";

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

describe("S3 treo", () => {
  test("mọi lệnh S3 có hạn giờ: máy S3 nhận kết nối mà không trả lời thì lệnh lỗi, không đứng mãi", async () => {
    const hung = Bun.listen({ hostname: "127.0.0.1", port: 0, socket: { data() {} } });
    const env = { S3_ENDPOINT: `http://127.0.0.1:${hung.port}`, S3_REGION: "x", S3_BUCKET: "zz-test-treo", S3_ACCESS_KEY_ID: "k", S3_SECRET_ACCESS_KEY: "s", S3_TIMEOUT_MS: "300" };
    const saved = Object.fromEntries(Object.keys(env).map((k) => [k, process.env[k]]));
    Object.assign(process.env, env);
    try {
      const key = `proofs/2026-11-05/${UUID}.webp`;
      const started = Date.now();
      await expect(readImage(key)).rejects.toThrow();
      await expect(deleteImage(key)).rejects.toThrow();
      await expect(writeImage(key, new Uint8Array([1]))).rejects.toThrow();
      expect(Date.now() - started).toBeLessThan(4000);
    } finally {
      for (const [k, v] of Object.entries(saved)) if (v === undefined) delete process.env[k];
      else process.env[k] = v;
      hung.stop(true);
    }
  }, 15_000);
});
