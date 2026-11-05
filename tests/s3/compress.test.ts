import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { cleanTestUsers } from "../db/helpers";
import { toHeic } from "../support/heic";
import { insertCustomer, setupProgram, type Program } from "../db/fixtures";
import { db } from "../../src/server/db/client";
import { proofPhotos } from "../../src/server/db/schema";
import { compressOne, compressQueue, MAX_BYTES, s3CompressStore, type CompressStore } from "../../src/server/compress";
import { deleteImage, newKey, readImage, writeImage } from "../../src/server/storage";

// Chạy trên bucket dev mgi-bank-dev và DB local; mọi object test tạo ra đều xoá ở afterAll.
if (process.env.S3_BUCKET === "mgst-images") throw new Error("Không chạy test trên bucket production của mgst-app.");

let p: Program;
const keys: string[] = [];

// Ảnh chụp màn hình giả: nền chuyển màu và 40 dòng chữ, png cỡ 1 MB.
async function screenshot(width: number, height: number, format: "png" | "webp", quality = 90): Promise<Uint8Array> {
  const lines = Array.from({ length: 40 }, (_, i) => `<text x="40" y="${80 + i * 90}" font-family="Arial" font-size="56" fill="#${((i * 2654435761) >>> 8).toString(16).padStart(6, "0").slice(0, 6)}">Dòng ${i} TRẦN MINH ANH AT105 ${i * 7919}</text>`).join("");
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3e7d3"/><stop offset="1" stop-color="#3a6ea5"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${lines}</svg>`);
  const img = sharp(svg);
  return new Uint8Array(format === "png" ? await img.png().toBuffer() : await img.webp({ quality }).toBuffer());
}

async function photoRow(key: string, sizeBytes: number | null): Promise<string> {
  const c = await insertCustomer(p, { fullName: "Cmpds Trần Minh Anh", status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "pending" }] });
  const [row] = await db.insert(proofPhotos).values({ customerBankId: c.rows.A, slotId: p.slot.A, s3Key: key, sizeBytes }).returning({ id: proofPhotos.id });
  return row.id;
}

async function stored(bytes: Uint8Array, ext: string): Promise<string> {
  const key = newKey("proofs", ext);
  keys.push(key, key.replace(/\.[a-z]+$/, ".webp"));
  await writeImage(key, bytes);
  return key;
}

// Đẩy lần thử trước về quá khứ để test không phải chờ hạn thử lại thật.
const retryNow = (id: string) => db.update(proofPhotos).set({ compressTriedAt: sql`now() - interval '1 day'` }).where(eq(proofPhotos.id, id));

const rowOf = async (id: string) => (await db.select().from(proofPhotos).where(eq(proofPhotos.id, id)))[0];

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("cmp", ["A"]);
});
afterAll(async () => {
  for (const key of keys) await deleteImage(key).catch(() => undefined);
  await cleanTestUsers();
});

describe("worker nén ảnh", () => {
  test("ảnh png lớn thành webp dưới 300 KB, cạnh dài 1600, khoá đổi đuôi, object cũ bị xoá", async () => {
    const png = await screenshot(2400, 3200, "png");
    expect(png.length).toBeGreaterThan(MAX_BYTES);
    const key = await stored(png, "png");
    const id = await photoRow(key, png.length);
    expect(await compressQueue()).toContain(id);

    expect(await compressOne(id)).toBe("compressed");
    const row = await rowOf(id);
    expect(row.s3Key).toBe(key.replace(/\.png$/, ".webp"));
    expect(row.compressedAt).not.toBeNull();
    const out = await readImage(row.s3Key);
    expect(out).not.toBeNull();
    expect(row.sizeBytes).toBe(out!.length);
    expect(out!.length).toBeLessThanOrEqual(MAX_BYTES);
    const meta = await sharp(out!).metadata();
    expect([meta.format, Math.max(meta.width!, meta.height!)]).toEqual(["webp", 1600]);
    expect(await readImage(key)).toBeNull();
    expect(await compressQueue()).not.toContain(id);
  }, 60_000);

  test("ảnh webp đã dưới 300 KB thì chỉ ghi compressed_at, không tải về, không đổi object", async () => {
    const webp = await screenshot(900, 1200, "webp", 60);
    expect(webp.length).toBeLessThanOrEqual(MAX_BYTES);
    const key = await stored(webp, "webp");
    const id = await photoRow(key, webp.length);

    expect(await compressOne(id)).toBe("kept");
    const row = await rowOf(id);
    expect([row.s3Key, row.sizeBytes, row.compressedAt !== null, row.compressAttempts]).toEqual([key, webp.length, true, 0]);
    expect(await readImage(key)).toEqual(webp);
  }, 30_000);

  test("ảnh webp quá 300 KB thì nén lại và ghi đè đúng khoá cũ", async () => {
    const webp = await screenshot(2400, 3200, "webp", 95);
    expect(webp.length).toBeGreaterThan(MAX_BYTES);
    const key = await stored(webp, "webp");
    const id = await photoRow(key, webp.length);

    expect(await compressOne(id)).toBe("compressed");
    const row = await rowOf(id);
    expect(row.s3Key).toBe(key);
    const out = await readImage(key);
    expect(out!.length).toBe(row.sizeBytes!);
    expect(out!.length).toBeLessThanOrEqual(MAX_BYTES);
  }, 60_000);

  test("ảnh HEIC đổi sang webp", async () => {
    // sips của macOS ghi được HEIC; máy khác không có thì bỏ qua.
    if (!existsSync("/usr/bin/sips")) return;
    const dir = mkdtempSync(join(tmpdir(), "mgi-heic-"));
    try {
      writeFileSync(join(dir, "a.png"), await screenshot(1200, 1600, "png"));
      execFileSync("/usr/bin/sips", ["-s", "format", "heic", join(dir, "a.png"), "--out", join(dir, "a.heic")], { stdio: "ignore" });
      const heic = new Uint8Array(readFileSync(join(dir, "a.heic")));
      const key = await stored(heic, "heic");
      const id = await photoRow(key, heic.length);

      expect(await compressOne(id)).toBe("compressed");
      const row = await rowOf(id);
      expect(row.s3Key).toBe(key.replace(/\.heic$/, ".webp"));
      const meta = await sharp((await readImage(row.s3Key))!).metadata();
      expect([meta.format, meta.width, meta.height]).toEqual(["webp", 1200, 1600]);
      expect(await readImage(key)).toBeNull();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 60_000);

  test("ảnh HEIC nằm dưới khoá .jpg vẫn nén sang webp: định dạng nhận theo nội dung", async () => {
    const heic = toHeic(await screenshot(1200, 1600, "png"));
    if (!heic) return;
    const key = await stored(heic, "jpg");
    const id = await photoRow(key, heic.length);

    expect(await compressOne(id)).toBe("compressed");
    const row = await rowOf(id);
    expect([row.s3Key, row.compressAttempts]).toEqual([key.replace(/\.jpg$/, ".webp"), 1]);
    const meta = await sharp((await readImage(row.s3Key))!).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 1200, 1600]);
    expect(await readImage(key)).toBeNull();
  }, 60_000);

  test("lỗi 3 lần thì dừng: ảnh gốc giữ nguyên khoá, không còn trong hàng chờ", async () => {
    const key = newKey("proofs", "jpg");
    const id = await photoRow(key, 500_000);
    for (const attempts of [1, 2, 3]) {
      expect(await compressOne(id)).toBe("failed");
      expect((await rowOf(id)).compressAttempts).toBe(attempts);
      await retryNow(id);
    }
    expect(await compressOne(id)).toBe("skipped");
    const row = await rowOf(id);
    expect([row.s3Key, row.compressedAt, row.compressAttempts]).toEqual([key, null, 3]);
    expect(await compressQueue()).not.toContain(id);
  }, 30_000);

  test("hai worker cùng lấy một ảnh: chỉ một bên nén", async () => {
    const png = await screenshot(2000, 2600, "png");
    const key = await stored(png, "png");
    const id = await photoRow(key, png.length);
    const results = await Promise.all([compressOne(id), compressOne(id)]);
    expect(results.sort()).toEqual(["compressed", "skipped"]);
    const row = await rowOf(id);
    expect([row.s3Key.endsWith(".webp"), row.compressAttempts]).toEqual([true, 1]);
  }, 60_000);
});

// Store S3 thật nhưng lượt tải dừng ở cổng tới khi test mở: test làm việc khác đúng lúc worker đang nén.
function gatedStore() {
  let open!: () => void;
  let entered!: () => void;
  const gate = new Promise<void>((r) => (open = r));
  const inside = new Promise<void>((r) => (entered = r));
  const store: CompressStore = {
    ...s3CompressStore,
    read: async (key) => {
      entered();
      await gate;
      return s3CompressStore.read(key);
    },
  };
  return { store, open, inside };
}

describe("worker nén không giữ khoá lúc nén", () => {
  test("số lần thử ghi xong trước khi tải ảnh: tiến trình chết giữa chừng vẫn tính một lần", async () => {
    const png = await screenshot(1200, 1600, "png");
    const key = await stored(png, "png");
    const id = await photoRow(key, png.length);
    const { store, open, inside } = gatedStore();
    const running = compressOne(id, store);
    await inside;
    const row = await rowOf(id).finally(open);
    expect([row.compressAttempts, row.compressedAt]).toEqual([1, null]);
    expect(await running).toBe("compressed");
  }, 60_000);

  test("học sinh chụp lại trong lúc nén: không bị chặn, dòng giữ ảnh mới, ảnh vừa nén bị xoá", async () => {
    const png = await screenshot(1200, 1600, "png");
    const key = await stored(png, "png");
    const id = await photoRow(key, png.length);
    const [old] = await db.select().from(proofPhotos).where(eq(proofPhotos.id, id));
    const { store, open, inside } = gatedStore();
    const running = compressOne(id, store);
    await inside;
    const fresh = newKey("proofs", "webp");
    const [created] = await db.transaction(async (tx) => {
      await tx.execute(sql`set local lock_timeout = '2s'`);
      await tx.delete(proofPhotos).where(eq(proofPhotos.id, id));
      return tx.insert(proofPhotos).values({ customerBankId: old.customerBankId, slotId: old.slotId, s3Key: fresh, sizeBytes: 1000 }).returning({ id: proofPhotos.id });
    }).finally(open);
    expect(await running).toBe("skipped");
    const row = await rowOf(created.id);
    expect([row.s3Key, row.compressedAt]).toEqual([fresh, null]);
    expect(await readImage(key.replace(/\.png$/, ".webp"))).toBeNull();
  }, 60_000);
});

describe("scripts/compress-worker.ts", () => {
  const worker = (...args: string[]) => spawn("bun", ["scripts/compress-worker.ts", ...args], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  const exited = (child: ReturnType<typeof worker>) => new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));

  test("--mot-vong nén ảnh trong hàng chờ rồi thoát", async () => {
    const png = await screenshot(1800, 2400, "png");
    const key = await stored(png, "png");
    const id = await photoRow(key, png.length);
    expect(await exited(worker("--mot-vong"))).toBe(0);
    const row = await rowOf(id);
    expect([row.s3Key.endsWith(".webp"), row.compressedAt !== null]).toEqual([true, true]);
  }, 60_000);

  test("SIGTERM thì dừng và thoát mã 0", async () => {
    const child = worker();
    let out = "";
    child.stdout!.on("data", (d) => (out += d));
    const done = exited(child);
    while (!out.includes("đang chạy")) await new Promise((r) => setTimeout(r, 50));
    child.kill("SIGTERM");
    expect(await done).toBe(0);
  }, 30_000);
});

