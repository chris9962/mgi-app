import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { closeSync, existsSync, mkdtempSync, openSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
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
      const r = Bun.spawnSync(["bun", "scripts/db-restore.ts", backup, `--that=${target}`], { env: { ...process.env, DATABASE_URL: url.toString(), BACKUP_S3_BUCKET: "zz-test-khong-dung", BACKUP_DB_CONTAINER: CONTAINER } });
      expect(r.exitCode, r.stderr.toString()).toBe(0);
      expect(sql("select to_regclass('public.zz_after_dump') is null, to_regtype('zz_after_type') is null").stdout.toString().trim()).toBe("t|t");
      expect(sql("select count(*) from drizzle.__drizzle_migrations").stdout.toString().trim()).toBe(migrations);
    } finally {
      dropDatabase(CONTAINER, source.user, target);
    }
  }, 90_000);
});

describe("khôi phục đè từ chối trước khi xoá", () => {
  const target = `zz_test_restore_dich_${Date.now()}`;
  const other = `zz_test_restore_khac_${Date.now()}`;
  const sqlIn = (database: string, q: string) => Bun.spawnSync(["docker", "exec", CONTAINER, "psql", "-U", source.user, "-d", database, "-v", "ON_ERROR_STOP=1", "-At", "-c", q]);
  const markerLeft = () => sqlIn(target, "select to_regclass('public.zz_marker') is not null").stdout.toString().trim();
  const restore = (file: string, flag: string) => {
    const url = new URL(process.env.DATABASE_URL!);
    url.pathname = `/${target}`;
    const r = Bun.spawnSync(["bun", "scripts/db-restore.ts", file, flag], { env: { ...process.env, DATABASE_URL: url.toString(), BACKUP_S3_BUCKET: "zz-test-khong-dung", BACKUP_DB_CONTAINER: CONTAINER } });
    return { code: r.exitCode, err: r.stderr.toString() };
  };
  const good = join(dir, "good.dump");

  beforeAll(() => {
    createDatabase(CONTAINER, source.user, target);
    sqlIn(target, "create table zz_marker (id int)");
    dumpDatabase(CONTAINER, source, good);
  });
  afterAll(() => {
    dropDatabase(CONTAINER, source.user, target);
    dropDatabase(CONTAINER, source.user, other);
  });

  test("bản dump của hệ khác (gõ tab nhầm sang dump của mgst-app) bị từ chối, database đích còn nguyên", () => {
    createDatabase(CONTAINER, source.user, other);
    sqlIn(other, "create table customers (id int); create table users (id int); insert into users values (1)");
    const file = join(dir, "khac.dump");
    const fd = openSync(file, "w");
    Bun.spawnSync(["docker", "exec", CONTAINER, "pg_dump", "-U", source.user, "-d", other, "-Fc"], { stdout: fd });
    closeSync(fd);
    const r = restore(file, `--that=${target}`);
    expect(r.code).toBe(1);
    expect(r.err).toContain("không phải bản sao lưu của mgi-bank");
    expect(markerLeft()).toBe("t");
  });

  test("gõ lại tên database sai hoặc không gõ thì từ chối, database đích còn nguyên", () => {
    const wrong = restore(good, "--that=mgibank");
    expect(wrong.code).toBe(1);
    expect(wrong.err).toContain("không khớp");
    const bare = restore(good, "--that");
    expect(bare.code).toBe(1);
    expect(bare.err).toContain(`--that=${target}`);
    expect(markerLeft()).toBe("t");
  });

  test("bản dump cắt cụt tới mất mục lục: từ chối trước khi xoá, database đích còn nguyên", () => {
    const cut = join(dir, "cut60.dump");
    const bytes = readFileSync(good);
    writeFileSync(cut, bytes.subarray(0, Math.floor(bytes.length * 0.6)));
    const r = restore(cut, `--that=${target}`);
    expect(r.code).toBe(1);
    expect(r.err).toContain("không đọc được bằng pg_restore");
    expect(markerLeft()).toBe("t");
  });

  test("bản dump còn mục lục mà mất phần dữ liệu (đĩa đầy giữa chừng): thoát mã 1, báo database đang rỗng và việc phải làm, không in bảng số dòng", () => {
    const cut = join(dir, "cut90.dump");
    const bytes = readFileSync(good);
    writeFileSync(cut, bytes.subarray(0, Math.floor(bytes.length * 0.9)));
    const r = restore(cut, `--that=${target}`);
    expect(r.code).toBe(1);
    expect(r.err).toContain(`Database ${target} lúc này RỖNG`);
    expect(r.err).toContain("Không bật app");
    expect(r.err).not.toContain("Bảng ");
    expect(sqlIn(target, "select count(*) from pg_tables where schemaname in ('public', 'drizzle')").stdout.toString().trim()).toBe("0");
  }, 60_000);
});
