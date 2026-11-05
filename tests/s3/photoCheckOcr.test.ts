import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { and, eq } from "drizzle-orm";
import { cleanTestUsers } from "../db/helpers";
import { insertCustomer, setupProgram, type Program } from "../db/fixtures";
import { bankScreen } from "../support/bankScreen";
import { toHeic } from "../support/heic";
import { db } from "../../src/server/db/client";
import { bankPhotoSlots, customerBanks, photoChecks, proofPhotos } from "../../src/server/db/schema";
import { closeOcr } from "../../src/server/ocr/reader";
import { queuePhotoChecks } from "../../src/server/photoChecks";
import { runPhotoCheck } from "../../src/server/photoCheckWorker";
import { deleteImage, newKey, writeImage } from "../../src/server/storage";

// OCR thật (PaddleOCR + VietOCR qua OCR_PYTHON) trên ảnh vẽ chữ lúc chạy test, ảnh để trên bucket dev rồi xoá ở afterAll.
if (process.env.S3_BUCKET === "mgst-images") throw new Error("Không chạy test trên bucket production của mgst-app.");
const withOcr = process.env.OCR_PYTHON ? describe : describe.skip;

let p: Program;
let other: Program;
const keys: string[] = [];

// Một hồ sơ đã gửi kiểm tra ở ngân hàng A, khung duy nhất bật kiểm họ tên và mã, ảnh vẽ đúng chữ trên màn.
async function queued(system: { name: string; code: string }, onImage: { name: string; code: string }, file?: { bytes: Uint8Array; ext: string }, program = p) {
  const c = await insertCustomer(program, { fullName: system.name, status: "pending_review", submittedAt: new Date(), banks: [{ key: "A", status: "pending" }] });
  const cb = c.rows.A;
  await db.update(customerBanks).set({ referralCode: system.code }).where(eq(customerBanks.id, cb));
  const key = newKey("proofs", file?.ext ?? "webp");
  keys.push(key);
  const bytes = file?.bytes ?? (await bankScreen(onImage));
  await writeImage(key, bytes);
  await db.insert(proofPhotos).values({ customerBankId: cb, slotId: program.slot.A, s3Key: key, sizeBytes: bytes.length });
  await db.transaction((tx) => queuePhotoChecks(tx, [cb]));
  const [check] = await db.select().from(photoChecks).where(and(eq(photoChecks.customerBankId, cb), eq(photoChecks.status, "pending")));
  return check.id;
}

const checkRow = async (id: string) => (await db.select().from(photoChecks).where(eq(photoChecks.id, id)))[0];

beforeAll(async () => {
  await cleanTestUsers();
  p = await setupProgram("pocr", ["A"]);
  other = await setupProgram("pocx", ["A"]);
  await db.update(bankPhotoSlots).set({ checkName: true, checkCode: true }).where(eq(bankPhotoSlots.id, p.slot.A));
});
afterAll(async () => {
  await closeOcr();
  for (const key of keys) await deleteImage(key).catch(() => undefined);
  await cleanTestUsers();
});

withOcr("worker kiểm ảnh với OCR thật", () => {
  const cases: { title: string; system: { name: string; code: string }; image: { name: string; code: string }; passed: boolean; reason: string }[] = [
    { title: "họ tên có dấu và mã đúng", system: { name: "Trần Minh Anh", code: "AT105" }, image: { name: "TRẦN MINH ANH", code: "AT105" }, passed: true, reason: "Họ tên và mã giới thiệu" },
    { title: "AT1050 không đạt cho mã AT105", system: { name: "Nguyễn Thị Hồng Nhung", code: "AT105" }, image: { name: "NGUYỄN THỊ HỒNG NHUNG", code: "AT1050" }, passed: false, reason: "Không tìm thấy mã giới thiệu AT105 trong ảnh." },
    { title: "mã có O và 0 đọc lại bằng model thứ hai", system: { name: "Lê Văn Ổi", code: "BO08" }, image: { name: "Lê Văn Ổi", code: "BO08" }, passed: true, reason: "Họ tên và mã giới thiệu" },
    { title: "mã có gạch nối, I và 1", system: { name: "Võ Hoàng Yến", code: "MGI-O1I0" }, image: { name: "Võ Hoàng Yến", code: "MGI-O1I0" }, passed: true, reason: "Họ tên và mã giới thiệu" },
    { title: "tên trên ảnh không dấu vẫn đạt", system: { name: "Phạm Quốc Đạt", code: "ND-TPB-01" }, image: { name: "PHAM QUOC DAT", code: "ND-TPB-01" }, passed: true, reason: "Họ tên và mã giới thiệu" },
    { title: "thiếu một chữ cái của tên thì không đạt", system: { name: "Trần Minh Anh", code: "AT106" }, image: { name: "TRẦN MINH AN", code: "AT106" }, passed: false, reason: "Không tìm thấy họ tên Trần Minh Anh trong ảnh." },
  ];

  for (const c of cases) {
    test(c.title, async () => {
      const id = await queued(c.system, c.image);
      expect(await runPhotoCheck(id)).toBe("done");
      const row = await checkRow(id);
      expect(row.result).toEqual([{ slotId: p.slot.A, slotName: "Ảnh A", expected: `${c.system.name} - ${c.system.code}`, passed: c.passed, reason: c.reason }]);
      expect([row.passed, row.total]).toEqual([c.passed ? 1 : 0, 1]);
    }, 180_000);
  }

  test("ảnh HEIC máy chủ không đổi được sang WebP vẫn đọc được, nhận định dạng theo nội dung chứ không theo đuôi khoá", async () => {
    const screen = { name: "Trần Minh Anh", code: "AT107" };
    const heic = toHeic(await bankScreen(screen, "png"));
    if (!heic) return;
    for (const ext of ["heic", "jpg"]) {
      const id = await queued(screen, screen, { bytes: heic, ext });
      expect(await runPhotoCheck(id)).toBe("done");
      const row = await checkRow(id);
      expect([row.status, row.error, row.passed, row.total]).toEqual(["done", "", 1, 1]);
    }
  }, 180_000);
});

withOcr("scripts/photo-check-worker.ts", () => {
  const worker = (...args: string[]) => spawn("bun", ["scripts/photo-check-worker.ts", ...args], { env: process.env, stdio: ["ignore", "pipe", "pipe"] });
  const exited = (child: ReturnType<typeof worker>) => new Promise<number | null>((resolve) => child.on("exit", (code) => resolve(code)));

  test("--mot-vong --truong kiểm lượt đang chờ của trường đó rồi thoát, không chạm lượt của trường khác", async () => {
    const screen = { name: "Đỗ Thị Ánh Tuyết", code: "OI10" };
    const id = await queued(screen, screen);
    const otherId = await queued(screen, screen, undefined, other);
    expect(await exited(worker("--mot-vong", `--truong=${p.schoolId}`))).toBe(0);
    const row = await checkRow(id);
    expect([row.status, row.passed, row.total]).toEqual(["done", 1, 1]);
    const untouched = await checkRow(otherId);
    expect([untouched.status, untouched.claimedAt]).toEqual(["pending", null]);
  }, 180_000);

  test("SIGTERM thì dừng và thoát mã 0", async () => {
    const child = worker(`--truong=${p.schoolId}`);
    let out = "";
    child.stdout!.on("data", (d) => (out += d));
    const done = exited(child);
    while (!out.includes("đang chạy")) await new Promise((r) => setTimeout(r, 50));
    child.kill("SIGTERM");
    expect(await done).toBe(0);
  }, 60_000);
});
