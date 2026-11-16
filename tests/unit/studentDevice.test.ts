import { describe, expect, test } from "bun:test";
import { decideLink, readDevice, saveProfile, saveSchool, clearProfile, schoolIdInLink } from "../../src/lib/studentDevice";

const A = "3f2b9c1e-8a4d-4f6b-9c2e-1a2b3c4d5e6f";
const B = "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";

describe("xử lý id trường trong link", () => {
  test("id không có trên máy chủ thì giữ trường đang lưu", () => {
    expect(decideLink({ linkId: B, linkFound: false, storedId: A, hasProfile: true })).toEqual({ kind: "keep" });
    expect(decideLink({ linkId: "abc", linkFound: false, storedId: null, hasProfile: false })).toEqual({ kind: "keep" });
  });

  test("cùng trường đang lưu thì giữ", () => {
    expect(decideLink({ linkId: A, linkFound: true, storedId: A, hasProfile: true })).toEqual({ kind: "keep" });
  });

  test("máy chưa có trường thì lưu trường trong link", () => {
    expect(decideLink({ linkId: B, linkFound: true, storedId: null, hasProfile: false })).toEqual({ kind: "switch", schoolId: B });
  });

  test("trường khác, máy chưa có hồ sơ thì đổi luôn", () => {
    expect(decideLink({ linkId: B, linkFound: true, storedId: A, hasProfile: false })).toEqual({ kind: "switch", schoolId: B });
  });

  test("trường khác, máy đã có hồ sơ thì hỏi", () => {
    expect(decideLink({ linkId: B, linkFound: true, storedId: A, hasProfile: true })).toEqual({ kind: "ask", schoolId: B });
  });
});

describe("đọc id trường từ chữ trong QR", () => {
  test("link của trường ra id, chữ viết hoa đổi thường", () => {
    expect(schoolIdInLink(`https://bank.mgst.com.vn/t/${A}`)).toBe(A);
    expect(schoolIdInLink(`http://bank.localhost:3100/t/${A.toUpperCase()}?x=1`)).toBe(A);
  });

  test("chữ không phải link trường thì null", () => {
    expect(schoolIdInLink("https://zalo.me/0900000000")).toBeNull();
    expect(schoolIdInLink(`https://x.vn/t/${A}abc`)).toBeNull();
    expect(schoolIdInLink("REF:ND-VPB-01")).toBeNull();
  });
});

const memory = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
};

describe("dữ liệu trên máy", () => {
  test("máy mới chưa có gì", () => {
    expect(readDevice(memory())).toEqual({ schoolId: null, customerId: null, token: null });
  });

  test("lưu hồ sơ rồi đổi trường thì mất hồ sơ cũ", () => {
    const s = memory();
    saveSchool(s, A);
    saveProfile(s, "c1", "tok");
    expect(readDevice(s)).toEqual({ schoolId: A, customerId: "c1", token: "tok" });
    clearProfile(s);
    saveSchool(s, B);
    expect(readDevice(s)).toEqual({ schoolId: B, customerId: null, token: null });
  });

  test("id trường lưu hỏng thì coi như chưa có", () => {
    const s = memory();
    s.setItem("mgi.schoolId", "../x");
    expect(readDevice(s).schoolId).toBeNull();
  });
});
