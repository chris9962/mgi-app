import { describe, expect, test } from "bun:test";
import { DEFAULT_SMS_TEMPLATE, renderSms, smsParts } from "../../src/lib/sms";

describe("mẫu SMS", () => {
  test("mẫu mặc định với dữ liệu mẫu dài 147 ký tự, 1 tin", () => {
    const text = renderSms(DEFAULT_SMS_TEMPLATE, { HO_TEN: "TRAN MINH ANH", LOP: "11A3", TRUONG: "THPT Nguyen Du", NGAN_HANG: "VPBank", MA_VOUCHER: "THPTND-TMA-11A3-K7Q2" });
    expect(text).toBe("TRAN MINH ANH (11A3, THPT Nguyen Du) da mo tai khoan VPBank. Ma voucher bao hiem: THPTND-TMA-11A3-K7Q2. Phu huynh nhap ma nay khi mua tren app PVI.");
    expect(text.length).toBe(147);
    expect(smsParts(text)).toBe(1);
  });
  test("quá 160 ký tự thì tách tin, mỗi tin 153 ký tự", () => {
    expect(smsParts("a".repeat(160))).toBe(1);
    expect(smsParts("a".repeat(161))).toBe(2);
    expect(smsParts("a".repeat(307))).toBe(3);
  });
});
