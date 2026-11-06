import { z } from "zod";
import { CONTROL_CHAR_MESSAGE, noControlChar } from "./controlChars";

export const SchoolForm = z.object({
  name: z.string().trim().min(1, "Nhập tên trường").refine(noControlChar, CONTROL_CHAR_MESSAGE),
  provinceCode: z.string().min(1, "Chọn tỉnh/thành phố").refine(noControlChar, CONTROL_CHAR_MESSAGE),
  wardCode: z.string().min(1, "Chọn xã/phường").refine(noControlChar, CONTROL_CHAR_MESSAGE),
  contactName: z.string().trim().min(1, "Nhập họ tên người liên hệ").refine(noControlChar, CONTROL_CHAR_MESSAGE),
  // Gõ SĐT có dấu cách, dấu chấm như cách đọc số thì bỏ đi, như SĐT ở form học sinh.
  contactPhone: z
    .string()
    .transform((v) => v.replace(/[\s.]/g, ""))
    .pipe(z.string().regex(/^0[0-9]{9}$/, "Số điện thoại gồm 10 số, bắt đầu bằng 0")),
});
export type SchoolFormValues = z.output<typeof SchoolForm>;
