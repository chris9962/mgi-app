import type { CustomerStatus } from "./studentState";

export const CUSTOMER_STATUSES = ["new", "banks_selected", "pending_review", "reviewed", "no_bank"] as const satisfies readonly CustomerStatus[];

export const CUSTOMER_STATUS_LABEL: Record<CustomerStatus, string> = {
  new: "Mới",
  banks_selected: "Đã chọn ngân hàng",
  pending_review: "Chờ kiểm tra",
  reviewed: "Đã kiểm tra",
  no_bank: "Không có ngân hàng",
};

export const PASSED_LABEL = { "1": "Đạt 1 ngân hàng", "2": "Đạt 2 ngân hàng" } as const;
export const CHECK_LABEL = { full: "Đủ khung đạt", missing: "Có khung không đạt" } as const;

export type CustomerFilters = {
  q: string;
  status: CustomerStatus | "";
  from: string;
  to: string;
  passed: keyof typeof PASSED_LABEL | "";
  check: keyof typeof CHECK_LABEL | "";
};

type Params = URLSearchParams | Record<string, string | string[] | undefined>;

const read = (sp: Params, key: string): string => {
  const v = sp instanceof URLSearchParams ? sp.get(key) : sp[key];
  return (Array.isArray(v) ? v[0] : v) ?? "";
};

const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const pick = <T extends string>(v: string, allowed: readonly T[]): T | "" => (allowed.includes(v as T) ? (v as T) : "");

// Bộ lọc nằm trên URL: trang, route xuất Excel và chip đọc cùng một chỗ, giá trị lạ thì bỏ.
export function parseCustomerFilters(sp: Params): CustomerFilters {
  const day = (k: string) => (isDay(read(sp, k)) ? read(sp, k) : "");
  return {
    q: read(sp, "q").trim(),
    status: pick(read(sp, "status"), CUSTOMER_STATUSES),
    from: day("from"),
    to: day("to"),
    passed: pick(read(sp, "passed"), ["1", "2"] as const),
    check: pick(read(sp, "check"), ["full", "missing"] as const),
  };
}

export function customerFilterQuery(f: CustomerFilters, extra: Record<string, string> = {}): string {
  const entries = Object.entries({ ...f, ...extra }).filter(([, v]) => v !== "");
  return new URLSearchParams(entries).toString();
}

// Ngày gửi tính theo giờ Việt Nam: "đến 04/11" là tới 00:00 ngày 05/11 giờ Việt Nam.
export function dayRange(from: string, to: string): { start: Date | null; end: Date | null } {
  const start = from ? new Date(`${from}T00:00:00+07:00`) : null;
  const end = to ? new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 24 * 3600 * 1000) : null;
  return { start, end };
}
