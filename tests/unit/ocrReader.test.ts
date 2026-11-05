import { afterAll, beforeAll, describe, expect, test } from "bun:test";
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
});
