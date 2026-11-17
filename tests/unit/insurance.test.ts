import { describe, expect, test } from "bun:test";
import { DEFAULT_THANKS_TEXT } from "../../src/lib/insurance";
import { DEFAULT_SMS_TEMPLATE, SettingsForm } from "../../src/lib/sms";

const base = { smsTemplate: DEFAULT_SMS_TEMPLATE, zaloUrl: "", pviAppUrl: "" };

describe("cài đặt bảo hiểm và lời cảm ơn", () => {
  test("không gửi thì link trống, hướng dẫn trống, lời cảm ơn mặc định", () => {
    const r = SettingsForm.parse(base);
    expect([r.insuranceStudentUrl, r.insuranceMotoUrl, r.insuranceElectricUrl]).toEqual(["", "", ""]);
    expect([r.insuranceStudentGuide, r.insuranceMotoGuide, r.insuranceElectricGuide]).toEqual(["", "", ""]);
    expect(r.thanksText).toBe(DEFAULT_THANKS_TEXT);
  });

  test("link bảo hiểm phải là http(s); hướng dẫn giữ xuống dòng, cấm ký tự điều khiển khác, tối đa 2000; lời cảm ơn một dòng tối đa 300", () => {
    expect(SettingsForm.safeParse({ ...base, insuranceMotoUrl: "mypvi.vn" }).success).toBe(false);
    expect(SettingsForm.parse({ ...base, insuranceMotoUrl: " https://mypvi.vn/xe-may ", insuranceMotoGuide: "Bước 1\r\nBước 2 " })).toMatchObject({ insuranceMotoUrl: "https://mypvi.vn/xe-may", insuranceMotoGuide: "Bước 1\nBước 2" });
    expect(SettingsForm.safeParse({ ...base, insuranceStudentGuide: "x\u0000" }).success).toBe(false);
    expect(SettingsForm.safeParse({ ...base, insuranceStudentGuide: "x".repeat(2001) }).success).toBe(false);
    expect(SettingsForm.safeParse({ ...base, thanksText: "x".repeat(301) }).success).toBe(false);
    expect(SettingsForm.parse({ ...base, thanksText: "  " }).thanksText).toBe(DEFAULT_THANKS_TEXT);
  });
});
