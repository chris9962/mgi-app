import { describe, expect, test } from "bun:test";
import { abbreviate, classPart, nameInitials, voucherCode, VOUCHER_ALPHABET, type VoucherInput } from "../../src/server/voucher";

const base: VoucherInput = {
  customerId: "8f2c0000-0000-4000-8000-000000000001",
  provinceCode: "80",
  wardCode: "25585",
  schoolName: "THPT Nguyễn Du",
  fullName: "Trần Minh Anh",
  className: "11A3",
};
const SECRET = "khoa-test";

describe("viết tắt", () => {
  test("bỏ dấu, viết hoa, chữ cái đầu mỗi từ; từ viết hoa toàn bộ giữ nguyên", () => {
    expect(abbreviate("THPT Nguyễn Du")).toBe("THPTND");
    expect(abbreviate("Trần Minh Anh")).toBe("TMA");
    expect(abbreviate("THCS  Lê Quý Đôn")).toBe("THCSLQD");
    expect(abbreviate("Đặng thị Ánh")).toBe("DTA");
    expect(abbreviate("trường thpt Chuyên")).toBe("TTC");
  });

  test("họ tên học sinh luôn lấy chữ cái đầu mỗi từ, kể cả khi gõ viết hoa toàn bộ", () => {
    expect(nameInitials("Trần Minh Anh")).toBe("TMA");
    expect(nameInitials("TRẦN MINH ANH")).toBe("TMA");
    expect(nameInitials("Lê Thị NGỌC")).toBe("LTN");
    expect(nameInitials("  đỗ   văn  A ")).toBe("DVA");
  });

  test("mã voucher của học sinh gõ tên viết hoa vẫn dùng chữ cái đầu", () => {
    expect(voucherCode({ ...base, fullName: "TRẦN MINH ANH" }, SECRET)).toMatch(/^THPTND-TMA-11A3-[A-Z0-9]{4}$/);
  });

  test("lớp viết hoa, bỏ khoảng trắng, chỉ giữ chữ và số", () => {
    expect(classPart("11a3")).toBe("11A3");
    expect(classPart(" 12 b 1 ")).toBe("12B1");
    expect(classPart("10-A/2")).toBe("10A2");
  });
});

describe("mã voucher", () => {
  test("đúng dạng ví dụ thiết kế, 4 ký tự kiểm trong bảng chữ dễ đọc", () => {
    const code = voucherCode(base, SECRET);
    expect(code).toMatch(/^THPTND-TMA-11A3-[A-Z0-9]{4}$/);
    expect(VOUCHER_ALPHABET).toBe("23456789ABCDEFGHJKMNPQRSTUVWXYZ");
    for (const ch of code.slice(-4)) expect(VOUCHER_ALPHABET).toContain(ch);
  });

  test("cùng dữ liệu cùng mã; khác id, xã hay khoá thì ký tự kiểm khác", () => {
    const code = voucherCode(base, SECRET);
    expect(voucherCode({ ...base }, SECRET)).toBe(code);
    const others = [
      voucherCode({ ...base, customerId: "8f2c0000-0000-4000-8000-000000000002" }, SECRET),
      voucherCode({ ...base, wardCode: "25586" }, SECRET),
      voucherCode({ ...base, provinceCode: "79" }, SECRET),
      voucherCode(base, "khoa-khac"),
    ];
    for (const o of others) {
      expect(o.slice(0, -4)).toBe(code.slice(0, -4));
      expect(o).not.toBe(code);
    }
  });

  test("lượt sinh lại khi trùng mã cho ký tự kiểm khác, lượt đầu giữ nguyên mã cũ", () => {
    const first = voucherCode(base, SECRET);
    expect(voucherCode(base, SECRET, 0)).toBe(first);
    const again = [1, 2, 3].map((n) => voucherCode(base, SECRET, n));
    expect(new Set([first, ...again]).size).toBe(4);
    for (const c of again) expect(c.slice(0, -4)).toBe(first.slice(0, -4));
    expect(voucherCode(base, SECRET, 1)).toBe(again[0]);
  });

  test("thiếu khoá thì không sinh mã", () => {
    expect(() => voucherCode(base, "")).toThrow();
  });

  test("bảng chữ không có 0, O, 1, I, L", () => {
    for (const ch of "0O1IL") expect(VOUCHER_ALPHABET).not.toContain(ch);
  });
});
