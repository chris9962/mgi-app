import { describe, expect, test } from "bun:test";
import { schoolsFlag } from "../../src/server/workerFlags";

const A = "3f2b9c1e-8a4d-4f6b-9c2e-1a2b3c4d5e6f";
const B = "0b7e1c2d-3e4f-4a5b-8c6d-7e8f9a0b1c2d";

describe("cờ --truong của worker", () => {
  test("không có cờ thì xử lý cả DB", () => {
    expect(schoolsFlag(["bun", "worker.ts", "--mot-vong"])).toBeUndefined();
  });

  test("--truong=<id>,<id> đọc được danh sách trường", () => {
    expect(schoolsFlag(["--truong=" + A + "," + B])).toEqual([A, B]);
  });

  test("cờ bắt đầu bằng --truong mà không đọc được thì dừng, không âm thầm xử lý cả DB", () => {
    for (const argv of [["--truong", A], ["--truong="], ["--truongs=" + A], ["--truong=abc"], ["--truong=" + A + ",x"]]) {
      expect(() => schoolsFlag(argv), argv.join(" ")).toThrow("--truong");
    }
  });
});
