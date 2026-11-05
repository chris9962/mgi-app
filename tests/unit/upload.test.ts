import { describe, expect, test } from "bun:test";
import { bodyTooLarge } from "../../src/lib/imageKey";

describe("dung lượng request tải ảnh", () => {
  const req = (len?: string) => new Request("http://admin.localhost/api/admin/uploads", { method: "POST", headers: len ? { "content-length": len } : {} });
  test("Content-Length quá 10 MB cộng phần đầu form thì chặn trước khi đọc body", () => {
    expect(bodyTooLarge(req(String(11 * 1024 * 1024)))).toBe(true);
    expect(bodyTooLarge(req(String(2 * 1024 * 1024)))).toBe(false);
  });
  test("thiếu Content-Length thì không chặn ở bước này", () => expect(bodyTooLarge(req())).toBe(false));
});
