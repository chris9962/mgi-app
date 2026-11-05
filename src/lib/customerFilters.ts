import type { CustomerStatus } from "./studentState";
import { dayRange, pickParam, queryOf, readDay, readParam, type Params } from "./urlParams";

export { dayRange };

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

// Bộ lọc nằm trên URL: trang, route xuất Excel và chip đọc cùng một chỗ, giá trị lạ thì bỏ.
export function parseCustomerFilters(sp: Params): CustomerFilters {
  return {
    q: readParam(sp, "q").trim(),
    status: pickParam(readParam(sp, "status"), CUSTOMER_STATUSES),
    from: readDay(sp, "from"),
    to: readDay(sp, "to"),
    passed: pickParam(readParam(sp, "passed"), ["1", "2"] as const),
    check: pickParam(readParam(sp, "check"), ["full", "missing"] as const),
  };
}

export const customerFilterQuery = (f: CustomerFilters, extra: Record<string, string> = {}): string => queryOf({ ...f, ...extra });
