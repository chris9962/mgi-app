import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { randomUUID } from "node:crypto";
import { cleanTestUsers } from "../db/helpers";
import { insertCustomer, setupProgram } from "../db/fixtures";
import { db } from "../../src/server/db/client";
import { proofPhotos } from "../../src/server/db/schema";
import { sweepOrphanProofs } from "../../src/server/orphans";
import { deleteImage, readImage, writeImage } from "../../src/server/storage";

// Chỉ đụng thư mục ngày 2099-01-01 của bucket dev: không ai khác ghi vào đó, object dev thật nằm yên.
if (process.env.S3_BUCKET === "mgst-images") throw new Error("Không chạy test trên bucket production của mgst-app.");
const PREFIX = "proofs/2099-01-01/";
const keyOf = () => `${PREFIX}${randomUUID()}.webp`;
const used = keyOf();
const orphan = keyOf();

beforeAll(async () => {
  await cleanTestUsers();
  const p = await setupProgram("orph", ["A"]);
  const c = await insertCustomer(p, { fullName: "Orphan Trần", status: "pending_review", banks: [{ key: "A", status: "pending" }] });
  await db.insert(proofPhotos).values({ customerBankId: c.rows.A, slotId: p.slot.A, s3Key: used, sizeBytes: 1 });
  for (const key of [used, orphan]) await writeImage(key, new Uint8Array([1, 2, 3]));
});
afterAll(async () => {
  for (const key of [used, orphan]) await deleteImage(key).catch(() => undefined);
  await cleanTestUsers();
});

describe("dọn object mồ côi trong proofs/", () => {
  test("object còn mới hơn mốc thì giữ, kể cả khi không dòng nào trỏ tới: transaction ghi ảnh có thể chưa commit", async () => {
    const r = await sweepOrphanProofs({ prefix: PREFIX, olderThan: new Date(Date.now() - 3_600_000) });
    expect(r.removed).toEqual([]);
    expect(await readImage(orphan)).not.toBeNull();
  });

  test("chạy khô chỉ liệt kê, không xoá", async () => {
    const r = await sweepOrphanProofs({ prefix: PREFIX, olderThan: new Date(Date.now() + 60_000), dryRun: true });
    expect(r.orphans).toEqual([orphan]);
    expect(r.removed).toEqual([]);
    expect(await readImage(orphan)).not.toBeNull();
  });

  test("object cũ hơn mốc mà không dòng proof_photos nào trỏ tới thì xoá; object đang dùng giữ nguyên", async () => {
    const r = await sweepOrphanProofs({ prefix: PREFIX, olderThan: new Date(Date.now() + 60_000) });
    expect(r.scanned).toBe(2);
    expect(r.removed).toEqual([orphan]);
    expect(await readImage(orphan)).toBeNull();
    expect(await readImage(used)).not.toBeNull();
  });

  test("hàng loạt ảnh không dòng nào trỏ tới (DB rỗng hoặc khôi phục sai) thì dừng, không xoá; chỉ xoá khi người vận hành chạy với force", async () => {
    const folder = "proofs/2099-01-02/";
    const many = Array.from({ length: 25 }, () => `${folder}${randomUUID()}.webp`);
    try {
      for (const key of many) await writeImage(key, new Uint8Array([1]));
      const olderThan = new Date(Date.now() + 60_000);
      await expect(sweepOrphanProofs({ prefix: folder, olderThan })).rejects.toThrow("25 trên 25");
      for (const key of many) expect(await readImage(key)).not.toBeNull();
      expect((await sweepOrphanProofs({ prefix: folder, olderThan, dryRun: true })).blocked).toContain("25 trên 25");
      expect((await sweepOrphanProofs({ prefix: folder, olderThan, force: true })).removed).toHaveLength(25);
    } finally {
      for (const key of many) await deleteImage(key).catch(() => undefined);
    }
  }, 120_000);
});
