import { z } from "zod";

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

export const SettingsForm = z.object({
  smsTemplate: z
    .string()
    .trim()
    .min(1, "Nhập mẫu SMS")
    .regex(/^[\x20-\x7E]+$/, "Mẫu SMS viết không dấu"),
  zaloUrl: url,
  pviAppUrl: url,
});
export type SettingsValues = z.output<typeof SettingsForm>;
