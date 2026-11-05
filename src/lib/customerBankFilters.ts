import { z } from "zod";
import { CHECK_LABEL } from "./customerFilters";
import type { CustomerBankStatus } from "./studentState";
import { pickParam, queryOf, readDay, readParam, type Params } from "./urlParams";

export { CHECK_LABEL };

export const CUSTOMER_BANK_STATUSES = ["selected", "pending", "passed", "failed"] as const satisfies readonly CustomerBankStatus[];

export const CUSTOMER_BANK_STATUS_LABEL: Record<CustomerBankStatus, string> = { selected: "Đang tạo", pending: "Chờ kiểm tra", passed: "Đạt", failed: "Không đạt" };

export type CustomerBankFilters = {
  q: string;
  from: string;
  to: string;
  bank: string[];
  status: CustomerBankStatus | "";
  check: keyof typeof CHECK_LABEL | "";
  school: string[];
  dir: "desc" | "asc";
};

const ids = (v: string): string[] => [...new Set(v.split(",").filter((id) => z.uuid().safeParse(id).success))].slice(0, 50);

// Ngân hàng và trường chọn được nhiều giá trị như ô Ngân hàng của mgst-app: id ghép bằng dấu phẩy trên URL.
export function parseCustomerBankFilters(sp: Params): CustomerBankFilters {
  return {
    q: readParam(sp, "q").trim(),
    from: readDay(sp, "from"),
    to: readDay(sp, "to"),
    bank: ids(readParam(sp, "bank")),
    status: pickParam(readParam(sp, "status"), CUSTOMER_BANK_STATUSES),
    check: pickParam(readParam(sp, "check"), ["full", "missing"] as const),
    school: ids(readParam(sp, "school")),
    dir: readParam(sp, "dir") === "asc" ? "asc" : "desc",
  };
}

export const customerBankFilterQuery = (f: CustomerBankFilters, extra: Record<string, string> = {}): string =>
  queryOf({ ...f, bank: f.bank.join(","), school: f.school.join(","), dir: f.dir === "asc" ? "asc" : "", ...extra });
