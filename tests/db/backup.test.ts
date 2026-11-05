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

  test("khôi phục đè (--that) bỏ mọi object tạo sau bản dump: bảng, kiểu của migration mới không còn, bảng migration về đúng bản dump", () => {
    const target = `zz_test_restore_that_${Date.now()}`;
    const sql = (q: string) => Bun.spawnSync(["docker", "exec", CONTAINER, "psql", "-U", source.user, "-d", target, "-v", "ON_ERROR_STOP=1", "-At", "-c", q]);
    createDatabase(CONTAINER, source.user, target);
    try {
      const base = join(dir, "base.dump");
      dumpDatabase(CONTAINER, source, base);
      restoreDump(CONTAINER, source.user, base, target);
      const backup = join(dir, "that.dump");
      dumpDatabase(CONTAINER, { user: source.user, database: target }, backup);
      const migrations = sql("select count(*) from drizzle.__drizzle_migrations").stdout.toString().trim();
      expect(sql("create type zz_after_type as enum ('a'); create table zz_after_dump (id int); insert into drizzle.__drizzle_migrations (hash, created_at) values ('zz', 0)").exitCode).toBe(0);

      const url = new URL(process.env.DATABASE_URL!);
      url.pathname = `/${target}`;
      const r = Bun.spawnSync(["bun", "scripts/db-restore.ts", backup, "--that"], { env: { ...process.env, DATABASE_URL: url.toString(), BACKUP_S3_BUCKET: "zz-test-khong-dung", BACKUP_DB_CONTAINER: CONTAINER } });
      expect(r.exitCode, r.stderr.toString()).toBe(0);
      expect(sql("select to_regclass('public.zz_after_dump') is null, to_regtype('zz_after_type') is null").stdout.toString().trim()).toBe("t|t");
      expect(sql("select count(*) from drizzle.__drizzle_migrations").stdout.toString().trim()).toBe(migrations);
    } finally {
      dropDatabase(CONTAINER, source.user, target);
    }
  }, 90_000);
});
