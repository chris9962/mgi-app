import { queryOf, readDay, readParam, type Params } from "./urlParams";

export type VoucherFilters = { q: string; from: string; to: string };

export const parseVoucherFilters = (sp: Params): VoucherFilters => ({ q: readParam(sp, "q").trim(), from: readDay(sp, "from"), to: readDay(sp, "to") });

export const voucherFilterQuery = (f: VoucherFilters, extra: Record<string, string> = {}) => queryOf({ ...f, ...extra });
