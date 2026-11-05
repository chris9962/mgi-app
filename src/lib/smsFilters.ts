import { pickParam, queryOf, readParam, type Params } from "./urlParams";

export const SMS_STATUS_LABEL = { failed: "Lỗi", queued: "Đang gửi", sent: "Đã gửi" } as const;
export type SmsStatus = keyof typeof SMS_STATUS_LABEL;

// Trang Tin SMS lỗi mở sẵn bộ lọc Lỗi; bỏ chip thì URL ghi status=all.
export type SmsFilters = { q: string; status: SmsStatus | "all" };

export const parseSmsFilters = (sp: Params): SmsFilters => ({
  q: readParam(sp, "q").trim(),
  status: pickParam(readParam(sp, "status"), ["failed", "queued", "sent", "all"] as const) || "failed",
});

export const smsFilterQuery = (f: SmsFilters, extra: Record<string, string> = {}) => queryOf({ q: f.q, status: f.status === "failed" ? "" : f.status, ...extra });
