import { afterAll, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DeleteObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { backupKey, downloadBackup, listBackups, newestBackup, pruneBackups, uploadBackup, type BackupS3 } from "../../scripts/lib/backup";

// Chạy trên bucket dev, chỉ trong thư mục zz-test-backup/; afterAll xoá mọi thứ test ghi.
if (process.env.S3_BUCKET === "mgst-images") throw new Error("Không chạy test trên bucket production của mgst-app.");
const PREFIX = "zz-test-backup/";
const s3: BackupS3 = {
  bucket: process.env.S3_BUCKET!,
  client: new S3Client({
    endpoint: process.env.S3_ENDPOINT,
    region: process.env.S3_REGION,
    forcePathStyle: true,
    credentials: { accessKeyId: process.env.S3_ACCESS_KEY_ID!, secretAccessKey: process.env.S3_SECRET_ACCESS_KEY! },
  }),
};
const dir = mkdtempSync(join(tmpdir(), "mgi-backup-s3-"));

afterAll(async () => {
  for (const o of await listBackups(s3, PREFIX)) await s3.client.send(new DeleteObjectCommand({ Bucket: s3.bucket, Key: o.key }));
  rmSync(dir, { recursive: true, force: true });
});

describe("sao lưu lên S3", () => {
  test("tải bản dump lên đúng khoá, đọc lại dung lượng khớp; bản mới nhất là bản vừa lên; tải về được nguyên byte", async () => {
    const file = join(dir, "a.dump");
    const bytes = new Uint8Array(4096).map((_, i) => i % 251);
    writeFileSync(file, bytes);
    const key = backupKey(new Date(), PREFIX);
    expect(await uploadBackup(s3, key, file)).toBe(4096);
    expect((await newestBackup(s3, PREFIX))?.key).toBe(key);
    const back = join(dir, "back.dump");
    await downloadBackup(s3, key, back);
    expect(new Uint8Array(await Bun.file(back).arrayBuffer())).toEqual(bytes);
  });

  test("dọn bản cũ theo ngày: thư mục ngày quá hạn bị xoá, ngày còn hạn giữ lại", async () => {
    const old = `${PREFIX}2020-01-01/mgi-bank-2020-01-01-0600.dump`;
    await s3.client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: old, Body: "cu" }));
    const fresh = backupKey(new Date(), PREFIX);
    await s3.client.send(new PutObjectCommand({ Bucket: s3.bucket, Key: fresh, Body: "moi" }));
    expect(await pruneBackups(s3, new Date(), 7, PREFIX)).toBe(1);
    const left = (await listBackups(s3, PREFIX)).map((o) => o.key);
    expect(left).not.toContain(old);
    expect(left).toContain(fresh);
  });
});
