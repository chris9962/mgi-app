import { describe, expect, test } from "bun:test";
import { appContainersFor, backupConfig, backupKey, dbTarget, staleKeys } from "../../scripts/lib/backup";

const S3 = { S3_ENDPOINT: "https://s3.example/", S3_REGION: "han02", S3_BUCKET: "mgi-bank-images", S3_ACCESS_KEY_ID: "app-key", S3_SECRET_ACCESS_KEY: "app-secret" };

describe("cấu hình sao lưu", () => {
  test("thiếu BACKUP_S3_BUCKET thì dừng", () => {
    expect(() => backupConfig(S3)).toThrow("BACKUP_S3_BUCKET");
  });

  test("bucket sao lưu trùng bucket ảnh thì dừng: đường xoá ảnh của app không được chạm bản sao lưu", () => {
    expect(() => backupConfig({ ...S3, BACKUP_S3_BUCKET: "mgi-bank-images" })).toThrow("trùng bucket ảnh");
  });

  test("không khai khoá riêng thì dùng khoá S3 của app; khai BACKUP_S3_* thì khoá riêng thắng", () => {
    expect(backupConfig({ ...S3, BACKUP_S3_BUCKET: "mgi-bank-backup" })).toEqual({ endpoint: "https://s3.example", region: "han02", bucket: "mgi-bank-backup", accessKeyId: "app-key", secretAccessKey: "app-secret" });
    expect(backupConfig({ ...S3, BACKUP_S3_BUCKET: "mgi-bank-backup", BACKUP_S3_ACCESS_KEY_ID: "bk", BACKUP_S3_SECRET_ACCESS_KEY: "bs" })).toMatchObject({ accessKeyId: "bk", secretAccessKey: "bs" });
  });

  test("không bao giờ ghi vào mgst-images", () => {
    expect(() => backupConfig({ ...S3, BACKUP_S3_BUCKET: "mgst-images" })).toThrow("mgst-images");
  });
});

describe("tên bản sao lưu", () => {
  test("đọc user và tên database từ DATABASE_URL", () => {
    expect(dbTarget("postgres://mgibank:secret@localhost:5434/mgibank")).toEqual({ user: "mgibank", database: "mgibank" });
    expect(() => dbTarget("postgres://u:p@localhost:5434/ten-la; drop")).toThrow();
  });

  test("khoá theo ngày giờ Việt Nam, một thư mục mỗi ngày", () => {
    expect(backupKey(new Date("2026-11-05T14:30:00Z"))).toBe("2026-11-05/mgi-bank-2026-11-05-2130.dump");
    expect(backupKey(new Date("2026-11-05T17:05:00Z"), "zz-test-backup/")).toBe("zz-test-backup/2026-11-06/mgi-bank-2026-11-06-0005.dump");
  });

  test("xoá theo ngày, không theo số file: thư mục ngày cũ hơn mốc giữ thì xoá, khoá lạ không đụng", () => {
    const keys = ["2026-10-28/a.dump", "2026-10-29/b.dump", "2026-11-04/c.dump", "2026-11-05/d.dump", "ghi-chu.txt"];
    expect(staleKeys(keys, new Date("2026-11-05T03:00:00Z"), 7, "")).toEqual(["2026-10-28/a.dump"]);
    expect(staleKeys(["zz-test-backup/2026-01-01/x.dump", "2026-01-01/y.dump"], new Date("2026-11-05T03:00:00Z"), 7, "zz-test-backup/")).toEqual(["zz-test-backup/2026-01-01/x.dump"]);
  });
});

describe("khôi phục đè", () => {
  test("container phải dừng trước khi khôi phục đè lấy theo tên container DB: production và bản test không lẫn nhau", () => {
    expect(appContainersFor("mgi-bank-db")).toEqual(["mgi-bank-app", "mgi-bank-sms", "mgi-bank-photo"]);
    expect(appContainersFor("mgi-bank-test-db")).toEqual(["mgi-bank-test-app", "mgi-bank-test-sms", "mgi-bank-test-photo"]);
  });
});

describe("scripts sao lưu", () => {
  const run = (script: string, env: Record<string, string>) => Bun.spawnSync(["bun", script], { env: { PATH: process.env.PATH ?? "", DATABASE_URL: "postgres://u:p@127.0.0.1:1/x", ...S3, ...env } });

  test("db-backup dừng trước khi dump khi bucket sao lưu trùng bucket ảnh", () => {
    const r = run("scripts/db-backup.ts", { BACKUP_S3_BUCKET: "mgi-bank-images" });
    expect(r.exitCode).toBe(1);
    expect(r.stderr.toString()).toContain("trùng bucket ảnh");
  });

  test("db-backup-check và db-restore báo thiếu BACKUP_S3_BUCKET", () => {
    for (const script of ["scripts/db-backup-check.ts", "scripts/db-restore.ts"]) {
      const r = run(script, {});
      expect(r.exitCode).toBe(1);
      expect(r.stderr.toString()).toContain("BACKUP_S3_BUCKET");
    }
  });
});
