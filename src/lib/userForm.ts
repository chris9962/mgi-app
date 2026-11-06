import { z } from "zod";
import { PERMISSIONS, ROLES } from "./types";
import { CONTROL_CHAR_MESSAGE, noControlChar } from "./controlChars";

const optionalText = z
  .string()
  .trim()
  .refine(noControlChar, CONTROL_CHAR_MESSAGE)
  .transform((v) => (v === "" ? null : v));

// Chuỗi rỗng đổi thành null: unique của staff_code chỉ bỏ qua null, không bỏ qua chuỗi rỗng.
export const UserForm = z.object({
  fullName: z.string().trim().min(1, "Nhập họ tên").refine(noControlChar, CONTROL_CHAR_MESSAGE),
  staffCode: optionalText,
  phone: z
    .string()
    .transform((v) => v.replace(/[\s.]/g, "") || null)
    .refine((v) => v === null || /^0[0-9]{9}$/.test(v), "Số điện thoại gồm 10 số, bắt đầu bằng 0"),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9._]{3,32}$/, "Tên đăng nhập 3 tới 32 ký tự: chữ thường không dấu, số, dấu chấm, gạch dưới"),
  role: z.enum(ROLES),
  title: z.string().trim().refine(noControlChar, CONTROL_CHAR_MESSAGE),
  permissions: z.array(z.enum(PERMISSIONS)),
});
export type UserFormInput = z.input<typeof UserForm>;
export type UserFormValues = z.output<typeof UserForm>;
