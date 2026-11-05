import { describe, expect, test } from "bun:test";
import { orphanGuard } from "../../src/server/orphanGuard";

describe("chốt chặn của job dọn ảnh mồ côi", () => {
  test("DB không có dòng proof_photos nào mà bucket có ảnh cũ: nghi DB rỗng hoặc khôi phục sai, không xoá", () => {
    expect(orphanGuard({ candidates: 3, orphans: 3, dbRows: 0 })).toContain("không có dòng proof_photos");
  });

  test("tỷ lệ mồ côi vượt 10% và hơn 20 ảnh: không xoá", () => {
    expect(orphanGuard({ candidates: 1000, orphans: 150, dbRows: 900 })).toContain("15%");
    expect(orphanGuard({ candidates: 30, orphans: 25, dbRows: 5 })).toContain("25 trên 30");
  });

  test("vài ảnh mồ côi lẻ tẻ thì cho xoá", () => {
    expect(orphanGuard({ candidates: 1000, orphans: 40, dbRows: 990 })).toBeNull();
    expect(orphanGuard({ candidates: 5, orphans: 2, dbRows: 3 })).toBeNull();
    expect(orphanGuard({ candidates: 0, orphans: 0, dbRows: 0 })).toBeNull();
  });
});
