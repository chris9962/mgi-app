import { afterAll, describe, expect, test } from "bun:test";
import { existsSync, mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createDatabase, dbTarget, dropDatabase, dumpDatabase, restoreDump, tableCounts } from "../../scripts/lib/backup";

// Dump DB local trong container mgi-bank-db, khôi phục vào database tạm cùng container rồi xoá database đó.
const CONTAINER = "mgi-bank-db";
const source = dbTarget(process.env.DATABASE_URL!);
const temp = `zz_test_restore_${Date.now()}`;
const dir = mkdtempSync(join(tmpdir(), "mgi-backup-"));

afterAll(() => {
  dropDatabase(CONTAINER, source.user, temp);
  rmSync(dir, { recursive: true, force: true });
});

describe("sao lưu và khôi phục", () => {
  test("dump DB ra file rồi khôi phục vào database tạm: đủ bảng, số dòng mỗi bảng khớp", () => {
    const file = join(dir, "mgi-bank.dump");
    dumpDatabase(CONTAINER, source, file);
    expect(statSync(file).size).toBeGreaterThan(0);

    createDatabase(CONTAINER, source.user, temp);
    restoreDump(CONTAINER, source.user, file, temp);
    const before = tableCounts(CONTAINER, source.user, source.database);
    const after = tableCounts(CONTAINER, source.user, temp);
    expect(Object.keys(before).length).toBeGreaterThanOrEqual(23);
    expect(after).toEqual(before);
  }, 60_000);

  test("file dump rỗng hoặc hỏng thì báo lỗi, không coi là bản sao lưu", () => {
    const file = join(dir, "hong.dump");
    expect(() => dumpDatabase(CONTAINER, { user: source.user, database: "zz_test_khong_co" }, file)).toThrow();
    expect(existsSync(file) ? statSync(file).size : 0).toBe(0);
  });

  test("tên database lạ bị từ chối trước khi chạy lệnh", () => {
    expect(() => createDatabase(CONTAINER, source.user, "x; drop database mgibank")).toThrow();
    expect(() => dropDatabase(CONTAINER, source.user, "mgibank")).toThrow("zz_test_");
  });
});
