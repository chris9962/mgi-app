import { describe, expect, test } from "bun:test";
import { CodeForm } from "../../src/lib/codeForm";
import { BankForm, GuideForm } from "../../src/lib/bankForm";
import { ADMIN_FOLDERS, allowedExt, extForMime, isAdminImageKey, isImageKey } from "../../src/lib/imageKey";

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
    const g = (sampleKey: unknown) => GuideForm.safeParse({ steps: [], slots: [{ name: "A", sampleKey, checkName: false, checkCode: false }], seenSlotIds: [] }).success;
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

describe("ảnh học sinh", () => {
  test("thư mục proofs nhận cả HEIC của iPhone", () => {
    expect(isImageKey(`proofs/2026-11-05/${UUID}.heic`, "proofs")).toBe(true);
    expect(allowedExt("proofs", "heic")).toBe(true);
    expect(allowedExt("proofs", "webp")).toBe(true);
    expect(allowedExt("proofs", "gif")).toBe(false);
  });
  test("đuôi theo loại ảnh trình duyệt khai, loại lạ thì null", () => {
    expect(extForMime("image/webp")).toBe("webp");
    expect(extForMime("image/jpeg")).toBe("jpg");
    expect(extForMime("image/heif")).toBe("heic");
    expect(extForMime("text/html")).toBeNull();
  });
  test("logo ngân hàng chỉ nhận khoá ảnh trong thư mục logos hoặc null; không gửi thì để trống", () => {
    const bank = (extra: object) => BankForm.safeParse({ code: "MB", name: "MB Bank", sortOrder: "1", managerIds: [], ...extra });
    expect(bank({ logoKey: `logos/2026-11-05/${UUID}.webp` }).success).toBe(true);
    expect(bank({ logoKey: null }).success).toBe(true);
    expect(bank({}).success).toBe(true);
    expect(bank({ logoKey: `samples/2026-11-05/${UUID}.webp` }).success).toBe(false);
    expect(bank({ logoKey: "/banks/mb.webp" }).success).toBe(false);
    expect(bank({ logoKey: "" }).success).toBe(false);
  });
  test("trang quản lý không tải ảnh vào thư mục proofs", () => {
    expect(ADMIN_FOLDERS).not.toContain("proofs");
  });
  test("route đọc ảnh của trang quản lý chỉ đọc ảnh mẫu, ảnh QR và logo, ảnh học sinh chờ kiểm quyền theo ngân hàng", () => {
    expect(isAdminImageKey(`samples/2026-11-05/${UUID}.jpg`)).toBe(true);
    expect(isAdminImageKey(`qr/2026-11-05/${UUID}.png`)).toBe(true);
    expect(isAdminImageKey(`logos/2026-11-05/${UUID}.webp`)).toBe(true);
    expect(isAdminImageKey(`proofs/2026-11-05/${UUID}.webp`)).toBe(false);
    expect(isAdminImageKey("../x")).toBe(false);
  });
});

describe("tab trong Hướng dẫn", () => {
  const guide = (steps: string[], slotName = "Ảnh một") => GuideForm.safeParse({ steps, slots: [{ name: slotName, sampleKey: null, checkName: false, checkCode: false }], seenSlotIds: [] });

  test("bước dán từ Word có tab: mỗi tab thành một dấu cách như form học sinh, không gộp khoảng trắng khác", () => {
    expect(guide(["•\tTải app", "Mở\t\ttài  khoản\t", "\tNhập mã"]).data?.steps).toEqual(["• Tải app", "Mở  tài  khoản", "Nhập mã"]);
  });

  test("bước chỉ có tab vẫn là bước trống; ký tự điều khiển khác trong bước vẫn báo lỗi; tên ảnh có tab vẫn báo lỗi ở ô tên ảnh", () => {
    expect(guide(["\t"]).success).toBe(false);
    expect(guide(["Tải\u0001app"]).error?.issues.map((i) => [i.path.join("."), i.message])).toEqual([["steps.0", "Có ký tự không hợp lệ"]]);
    expect(guide(["Tải app"], "Ảnh\tmột").error?.issues.map((i) => [i.path.join("."), i.message])).toEqual([["slots.0.name", "Có ký tự không hợp lệ"]]);
  });
});
