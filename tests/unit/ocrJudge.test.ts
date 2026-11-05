import { describe, expect, test } from "bun:test";
import { judgeSlot, partsOf } from "../../src/server/ocr/judge";

const values = { fullName: "Trần Minh Anh", referralCode: "ND-TPB-01" };
const slot = (checkName: boolean, checkCode: boolean) => ({ slotId: "s1", slotName: "Ảnh màn hình chính", checkName, checkCode });

describe("khung cần kiểm gì", () => {
  test("theo check_name, check_code của khung", () => {
    expect(partsOf(slot(true, true), values)).toEqual({ name: true, code: true });
    expect(partsOf(slot(true, false), values)).toEqual({ name: true, code: false });
    expect(partsOf(slot(false, false), values)).toEqual({ name: false, code: false });
  });

  test("dòng ngân hàng không có mã chữ thì không so mã", () => {
    expect(partsOf(slot(true, true), { ...values, referralCode: "" })).toEqual({ name: true, code: false });
    expect(partsOf(slot(false, true), { ...values, referralCode: " " })).toEqual({ name: false, code: false });
  });
});

describe("kết quả một khung", () => {
  test("thấy đủ họ tên và mã: Đạt, câu lý do nêu cái đã kiểm, giá trị hệ thống ghép bằng gạch nối", () => {
    expect(judgeSlot(slot(true, true), ["Họ và tên", "TRẦN MINH ANH", "Mã giới thiệu ND-TPB-01"], values)).toEqual({
      slotId: "s1",
      slotName: "Ảnh màn hình chính",
      expected: "Trần Minh Anh - ND-TPB-01",
      passed: true,
      reason: "Họ tên và mã giới thiệu",
    });
    expect(judgeSlot(slot(true, false), ["TRAN MINH ANH"], values)).toMatchObject({ expected: "Trần Minh Anh", passed: true, reason: "Họ tên" });
    expect(judgeSlot(slot(false, true), ["ND-TPB-01"], values)).toMatchObject({ expected: "ND-TPB-01", passed: true, reason: "Mã giới thiệu" });
  });

  test("không thấy mã: Không tìm thấy kèm giá trị hệ thống, không trích chữ trên ảnh", () => {
    const item = judgeSlot(slot(true, true), ["TRAN MINH ANH", "ND-TPB-O1"], values);
    expect(item).toMatchObject({ passed: false, reason: "Không tìm thấy mã giới thiệu ND-TPB-01 trong ảnh." });
    expect(item.reason).not.toContain("O1");
  });

  test("không thấy họ tên, hoặc cả hai", () => {
    expect(judgeSlot(slot(true, true), ["TRAN MINH", "ND-TPB-01"], values).reason).toBe("Không tìm thấy họ tên Trần Minh Anh trong ảnh.");
    expect(judgeSlot(slot(true, true), [], values).reason).toBe("Không tìm thấy họ tên Trần Minh Anh và mã giới thiệu ND-TPB-01 trong ảnh.");
  });

  test("khung chưa có ảnh: Không đạt", () => {
    expect(judgeSlot(slot(true, true), null, values)).toMatchObject({ passed: false, reason: "Chưa có ảnh.", expected: "Trần Minh Anh - ND-TPB-01" });
  });
});
