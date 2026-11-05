import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { closeOcr, ocrLines } from "../../src/server/ocr/reader";

// Trỏ reader sang OCR giả chạy bằng bun: test được treo, chết, chữ rác mà không cần Python.
const env = { OCR_PYTHON: process.execPath, OCR_SERVER: join(import.meta.dir, "../support/fakeOcrServer.ts"), OCR_TIMEOUT_MS: "1000" };
const image = (text: string) => new TextEncoder().encode(text);

beforeAll(() => {
  Object.assign(process.env, env);
});
afterAll(async () => {
  await closeOcr();
  for (const key of Object.keys(env)) delete process.env[key];
});

describe("reader OCR", () => {
  test("trả từng dòng chữ", async () => {
    expect(await ocrLines(image("TRAN MINH ANH\nAT105"))).toEqual(["TRAN MINH ANH", "AT105"]);
  });

  test("tiến trình treo thì lượt đó lỗi sau thời gian chờ, lượt sau mở lại tiến trình và đọc được", async () => {
    await expect(ocrLines(image("TREO"))).rejects.toThrow("Đọc ảnh quá 1 giây.");
    expect(await ocrLines(image("AT105"))).toEqual(["AT105"]);
  });

  test("tiến trình chết thì lượt đó lỗi, lượt sau mở lại", async () => {
    await expect(ocrLines(image("CHET"))).rejects.toThrow("Tiến trình OCR thoát");
    expect(await ocrLines(image("AT106"))).toEqual(["AT106"]);
  });

  test("chữ rác dính trước JSON trên cùng dòng vẫn đọc được", async () => {
    expect(await ocrLines(image("RAC"))).toEqual(["RAC"]);
  });

  test("lượt hết giờ lúc tiến trình đang mở: các lượt sau dùng đúng một tiến trình mới, không bỏ sót tiến trình nào", async () => {
    await closeOcr();
    const dir = mkdtempSync(join(tmpdir(), "mgi-fake-ocr-"));
    const pidsFile = join(dir, "pids");
    writeFileSync(join(dir, "hang"), "");
    Object.assign(process.env, { FAKE_OCR_HANG_START: join(dir, "hang"), FAKE_OCR_PIDS: pidsFile });
    try {
      await expect(ocrLines(image("A"))).rejects.toThrow("Đọc ảnh quá 1 giây.");
      expect(await ocrLines(image("B"))).toEqual(["B"]);
      expect(await ocrLines(image("C"))).toEqual(["C"]);
      const pids = readFileSync(pidsFile, "utf8").split("\n").filter(Boolean).map(Number);
      expect(pids).toHaveLength(2);
      await closeOcr();
      const alive = (pid: number) => {
        try {
          process.kill(pid, 0);
          return true;
        } catch {
          return false;
        }
      };
      for (let i = 0; i < 40 && pids.some(alive); i++) await new Promise((r) => setTimeout(r, 50));
      expect(pids.filter(alive)).toEqual([]);
    } finally {
      delete process.env.FAKE_OCR_HANG_START;
      delete process.env.FAKE_OCR_PIDS;
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
