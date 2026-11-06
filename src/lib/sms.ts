import { z } from "zod";
import { removeDiacritics } from "./text";
import { CONTROL_CHAR_MESSAGE, noControlChar } from "./controlChars";

// Loại tin duy nhất hiện có; DB chỉ nhận giá trị này (check sms_messages_kind).
export const SMS_KIND_VOUCHER = "voucher";

export const SMS_FIELDS = ["HO_TEN", "LOP", "TRUONG", "NGAN_HANG", "MA_VOUCHER"] as const;
export type SmsField = (typeof SMS_FIELDS)[number];

export const DEFAULT_SMS_TEMPLATE = "{HO_TEN} ({LOP}, {TRUONG}) da mo tai khoan {NGAN_HANG}. Ma voucher bao hiem: {MA_VOUCHER}. Phu huynh nhap ma nay khi mua tren app PVI.";
export const DEFAULT_PVI_APP_URL = "https://www.pvi.com.vn";

export const SMS_SAMPLE: Record<SmsField, string> = { HO_TEN: "TRAN MINH ANH", LOP: "11A3", TRUONG: "THPT Nguyen Du", NGAN_HANG: "VPBank", MA_VOUCHER: "THPTND-TMA-11A3-K7Q2" };

export const renderSms = (template: string, values: Record<SmsField, string>) => template.replace(/\{([A-Z_]+)\}/g, (all, key: string) => values[key as SmsField] ?? all);

// Một ký tự ngoài ASCII làm nhà mạng gửi tin dạng UCS-2, 70 ký tự một tin: bỏ dấu, đổi gạch ngang và ngoặc kiểu chữ, bỏ ký tự còn lại.
export const asciiSms = (s: string): string =>
  removeDiacritics(s)
    .replace(/[\u2010-\u2015\u2212]/g, "-")
    .replace(/[\u2018\u2019\u201a\u201b\u2032]/g, "'")
    .replace(/[\u201c-\u201f\u2033]/g, '"')
    .replace(/\u2026/g, "...")
    .replace(/\s/g, " ")
    .replace(/[^\x20-\x7E]/g, "")
    .replace(/ {2,}/g, " ")
    .trim();

export const smsValues = (v: { fullName: string; className: string; schoolName: string; bankName: string; code: string }): Record<SmsField, string> => ({
  HO_TEN: asciiSms(v.fullName).toUpperCase(),
  LOP: asciiSms(v.className),
  TRUONG: asciiSms(v.schoolName),
  NGAN_HANG: asciiSms(v.bankName),
  MA_VOUCHER: asciiSms(v.code),
});

// Tin không dấu dài tối đa 160 ký tự; tin dài hơn tách thành nhiều phần, mỗi phần 153 ký tự.
export const smsParts = (text: string) => (text.length <= 160 ? 1 : Math.ceil(text.length / 153));

// Web học sinh vẽ QR của link; QR mức M chứa tối đa 2.331 byte, link dài hơn thì không vẽ được QR. 500 ký tự có dấu vẫn dưới mức đó.
const URL_MAX = 500;

const url = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\/\S/i.test(v), { message: "Link phải bắt đầu bằng http:// hoặc https://", abort: true })
  .refine((v) => !/\s/.test(v), { message: "Link không được có dấu cách", abort: true })
  .refine(noControlChar, { message: CONTROL_CHAR_MESSAGE, abort: true })
  .max(URL_MAX, `Link tối đa ${URL_MAX} ký tự`);

// Biến gõ sai như {HOTEN} không được thay, phụ huynh nhận nguyên chữ {HOTEN}: chặn từ lúc lưu mẫu.
const unknownField = (template: string): string | null => {
  const rest = template.replace(/\{([A-Z_]+)\}/g, (all, key: string) => ((SMS_FIELDS as readonly string[]).includes(key) ? "" : all));
  return /[{}]/.test(rest) ? (/\{[^{}]*\}/.exec(rest)?.[0] ?? "{") : null;
};

export const SettingsForm = z.object({
  smsTemplate: z
    .string()
    .trim()
    .min(1, { message: "Nhập mẫu SMS", abort: true })
    .refine((v) => !/[\r\n]/.test(v), { message: "Mẫu SMS viết trên một dòng", abort: true })
    .regex(/^[\x20-\x7E]+$/, "Mẫu SMS viết không dấu")
    .superRefine((v, ctx) => {
      const bad = unknownField(v);
      if (bad) ctx.addIssue({ code: "custom", message: bad.length > 1 ? `Mẫu SMS có biến không có thật: ${bad}` : "Mẫu SMS có dấu ngoặc { } lẻ" });
      // Tin SMS chỉ để gửi mã voucher cho phụ huynh: mẫu thiếu biến mã thì tin gửi đi vô dụng.
      else if (!v.includes("{MA_VOUCHER}")) ctx.addIssue({ code: "custom", message: "Mẫu SMS phải có {MA_VOUCHER}" });
    }),
  zaloUrl: url,
  pviAppUrl: url,
});
export type SettingsValues = z.output<typeof SettingsForm>;
