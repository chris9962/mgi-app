import { readIds } from "./customerBankFilters";
import { SMS_STATUS_LABEL, type SmsStatus } from "./smsFilters";
import { pickParam, queryOf, readDay, readParam, type Params } from "./urlParams";

export type VoucherFilters = { q: string; from: string; to: string; school: string[]; bank: string[]; sms: SmsStatus | "" };

export const VOUCHER_SMS_STATUSES = Object.keys(SMS_STATUS_LABEL) as SmsStatus[];

export const parseVoucherFilters = (sp: Params): VoucherFilters => ({
  q: readParam(sp, "q").trim(),
  from: readDay(sp, "from"),
  to: readDay(sp, "to"),
  school: readIds(readParam(sp, "school")),
  bank: readIds(readParam(sp, "bank")),
  sms: pickParam(readParam(sp, "sms"), VOUCHER_SMS_STATUSES),
});

export const voucherFilterQuery = (f: VoucherFilters, extra: Record<string, string> = {}) => queryOf({ ...f, school: f.school.join(","), bank: f.bank.join(","), ...extra });
