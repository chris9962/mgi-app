import { z } from "zod";

export const SchoolForm = z.object({
  name: z.string().trim().min(1, "Nhập tên trường"),
  provinceCode: z.string().min(1, "Chọn tỉnh/thành phố"),
  wardCode: z.string().min(1, "Chọn xã/phường"),
  contactName: z.string().trim().min(1, "Nhập họ tên người liên hệ"),
  contactPhone: z.string().trim().regex(/^0[0-9]{9}$/, "Số điện thoại gồm 10 số, bắt đầu bằng 0"),
});
export type SchoolFormValues = z.output<typeof SchoolForm>;
