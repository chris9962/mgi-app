import { describe, expect, test } from "bun:test";
import { cpuPercentBetween, parseCpuSample, parseDf, parseMeminfo } from "../../src/server/hostProbe";
import { formatBytes, resourcePercent } from "../../src/lib/ops";

const STAT = (user: number, idle: number, iowait: number) =>
  `cpu  ${user} 0 100 ${idle} ${iowait} 0 20 0 0 0\ncpu0 1 0 1 1 0 0 0 0 0 0\nintr 12345\n`;

describe("đọc /proc/stat", () => {
  test("lấy dòng cpu tổng, rảnh gồm idle cộng iowait", () => {
    expect(parseCpuSample(STAT(500, 3000, 200))).toEqual({ idle: 3200, total: 500 + 100 + 3000 + 200 + 20 });
  });

  test("phần trăm là hiệu của hai mẫu", () => {
    const before = parseCpuSample(STAT(500, 3000, 0))!;
    const after = parseCpuSample(STAT(800, 3700, 0))!;
    expect(cpuPercentBetween(before, after)).toBe(30);
  });

  test("hai mẫu bằng nhau thì 0%, chữ lạ thì không đọc", () => {
    const s = parseCpuSample(STAT(1, 1, 1))!;
    expect(cpuPercentBetween(s, s)).toBe(0);
    expect(parseCpuSample("")).toBeNull();
    expect(parseCpuSample("intr 1 2 3")).toBeNull();
  });
});

describe("đọc /proc/meminfo", () => {
  test("RAM đã dùng là MemTotal trừ MemAvailable, không trừ MemFree", () => {
    const text = "MemTotal:        8000000 kB\nMemFree:          100000 kB\nMemAvailable:    5000000 kB\nBuffers: 1 kB\n";
    expect(parseMeminfo(text)).toEqual({ used: 3000000 * 1024, total: 8000000 * 1024 });
  });

  test("thiếu MemTotal thì không đọc", () => {
    expect(parseMeminfo("MemFree: 1 kB")).toBeNull();
  });
});

describe("đọc df -kP", () => {
  test("lấy cột tổng và đã dùng của dòng thứ hai, đổi KB sang byte", () => {
    const out = "Filesystem     1024-blocks     Used Available Capacity Mounted on\n/dev/vda1       83886080 31038464  52847616      38% /\n";
    expect(parseDf(out)).toEqual({ used: 31038464 * 1024, total: 83886080 * 1024 });
  });

  test("không có dòng số liệu thì không đọc", () => {
    expect(parseDf("Filesystem 1024-blocks Used\n")).toBeNull();
  });
});

describe("hiện số đo", () => {
  test("dung lượng theo đơn vị 1024, phần lẻ dấu phẩy", () => {
    expect(formatBytes(3.3 * 1024 ** 3)).toBe("3,3 GB");
    expect(formatBytes(8 * 1024 ** 3)).toBe("8 GB");
    expect(formatBytes(500 * 1024 ** 3)).toBe("500 GB");
    expect(formatBytes(512)).toBe("512 B");
  });

  test("phần trăm làm tròn, cắt ở 100, mẫu số 0 thì không có", () => {
    expect(resourcePercent(23.4, 100)).toBe(23);
    expect(resourcePercent(130, 100)).toBe(100);
    expect(resourcePercent(5, 0)).toBeNull();
  });
});
