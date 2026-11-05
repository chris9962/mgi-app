import { eq, inArray, sql, type AnyColumn, type SQL } from "drizzle-orm";
import { db } from "./db/client";
import { customerBanks, customers } from "./db/schema";

// Worker chỉ xử lý dòng ngân hàng của các trường được chỉ: test và e2e không chạm hồ sơ khác trong DB local. Không chỉ thì xử lý hết.
export const ofSchools = (customerBankId: AnyColumn, schoolIds?: string[]): SQL | undefined =>
  schoolIds === undefined
    ? undefined
    : schoolIds.length
      ? inArray(customerBankId, db.select({ id: customerBanks.id }).from(customerBanks).innerJoin(customers, eq(customers.id, customerBanks.customerId)).where(inArray(customers.schoolId, schoolIds)))
      : sql`false`;

export { schoolsFlag } from "./workerFlags";
