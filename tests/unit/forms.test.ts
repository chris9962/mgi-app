import { describe, expect, test } from "bun:test";
import { CodeForm } from "../../src/lib/codeForm";
import { GuideForm } from "../../src/lib/bankForm";
import { allowedExt, isImageKey } from "../../src/lib/imageKey";

const UUID = "3f2b9c1e-8a4d-4f6b-9c2e-1a2b3c4d5e6f";
const BANK = "6c7d8e9f-1a2b-4c3d-8e4f-5a6b7c8d9e0f";
const code = (qrKey: unknown, codeText = "") => CodeForm.safeParse({ bankId: BANK, displayName: "x", code: codeText, qrKey, openUrl: "", monthlyQuota: "1", priority: "0", schoolIds: [] });

describe("khoá ảnh trong form", () => {
  test("mã chỉ có qrKey rỗng thì bị từ chối", () => expect(code("").success).toBe(false));
  test("qrKey phải nằm trong thư mục qr", () => {
    expect(code(`samples/2026-11-05/${UUID}.png`).success).toBe(false);
    expect(code(`qr/2026-11-05/${UUID}.png`).success).toBe(true);
    expect(code("../../.env.local").success).toBe(false);
  });
  test("ảnh mẫu phải nằm trong thư mục samples", () => {
    const g = (sampleKey: unknown) => GuideForm.safeParse({ steps: [], slots: [{ name: "A", sampleKey, checkName: false, checkCode: false }] }).success;
    expect(g(null)).toBe(true);
    expect(g(`samples/2026-11-05/${UUID}.jpg`)).toBe(true);
    expect(g(`qr/2026-11-05/${UUID}.jpg`)).toBe(false);
    expect(g("javascript:alert(1)")).toBe(false);
  });
  test("isImageKey kiểm cả thư mục", () => {
    expect(isImageKey(`qr/2026-11-05/${UUID}.webp`, "qr")).toBe(true);
    expect(isImageKey(`qr/2026-11-05/${UUID}.webp`, "samples")).toBe(false);
  });
});

describe("đuôi ảnh theo thư mục", () => {
  test("ảnh mẫu và ảnh QR không nhận HEIC vì Chrome, Android không hiện được", () => {
    expect(allowedExt("samples", "heic")).toBe(false);
    expect(allowedExt("qr", "heic")).toBe(false);
    expect(allowedExt("samples", "jpg")).toBe(true);
    expect(allowedExt("qr", "png")).toBe(true);
  });
});
