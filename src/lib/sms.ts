import { z } from "zod";

// Loại tin duy nhất hiện có; DB chỉ nhận giá trị này (check sms_messages_kind).
export const SMS_KIND_VOUCHER = "voucher";

export const SMS_FIELDS = ["HO_TEN", "LOP", "TRUONG", "NGAN_HANG", "MA_VOUCHER"] as const;
export type SmsField = (typeof SMS_FIELDS)[number];

export const DEFAULT_SMS_TEMPLATE = "{HO_TEN} ({LOP}, {TRUONG}) da mo tai khoan {NGAN_HANG}. Ma voucher bao hiem: {MA_VOUCHER}. Phu huynh nhap ma nay khi mua tren app PVI.";
export const DEFAULT_PVI_APP_URL = "https://www.pvi.com.vn";

export const SMS_SAMPLE: Record<SmsField, string> = { HO_TEN: "TRAN MINH ANH", LOP: "11A3", TRUONG: "THPT Nguyen Du", NGAN_HANG: "VPBank", MA_VOUCHER: "THPTND-TMA-11A3-K7Q2" };

export const renderSms = (template: string, values: Record<SmsField, string>) => template.replace(/\{([A-Z_]+)\}/g, (all, key: string) => values[key as SmsField] ?? all);

// Tin không dấu dài tối đa 160 ký tự; tin dài hơn tách thành nhiều phần, mỗi phần 153 ký tự.
export const smsParts = (text: string) => (text.length <= 160 ? 1 : Math.ceil(text.length / 153));

const url = z
  .string()
  .trim()
  .refine((v) => v === "" || /^https?:\/\/\S+$/i.test(v), "Link phải bắt đầu bằng http:// hoặc https://");

// Biến gõ sai như {HOTEN} không được thay, phụ huynh nhận nguyên chữ {HOTEN}: chặn từ lúc lưu mẫu.
const unknownField = (template: string): string | null => {
  const rest = template.replace(/\{([A-Z_]+)\}/g, (all, key: string) => ((SMS_FIELDS as readonly string[]).includes(key) ? "" : all));
  return /[{}]/.test(rest) ? (/\{[^{}]*\}/.exec(rest)?.[0] ?? "{") : null;
};

export const SettingsForm = z.object({
  smsTemplate: z
    .string()
    .trim()
    .min(1, "Nhập mẫu SMS")
    .regex(/^[\x20-\x7E]+$/, "Mẫu SMS viết không dấu")
    .superRefine((v, ctx) => {
      const bad = unknownField(v);
      if (bad) ctx.addIssue({ code: "custom", message: bad.length > 1 ? `Mẫu SMS có biến không có thật: ${bad}` : "Mẫu SMS có dấu ngoặc { } lẻ" });
    }),
  zaloUrl: url,
  pviAppUrl: url,
});
export type SettingsValues = z.output<typeof SettingsForm>;
