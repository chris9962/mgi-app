import { z } from "zod";

// Không đặt luật độ dài như mgst-app: nhân viên gõ trên điện thoại, mỗi luật thêm một cuộc gọi hỏi hỗ trợ.
export const PasswordForm = z
  .object({
    currentPassword: z.string().min(1, "Nhập mật khẩu hiện tại"),
    newPassword: z.string().min(1, "Nhập mật khẩu mới"),
    confirmPassword: z.string().min(1, "Nhập lại mật khẩu mới"),
  })
  .refine((f) => f.newPassword === f.confirmPassword, { path: ["confirmPassword"], message: "Hai lần nhập không giống nhau" });
export type PasswordFormValues = z.output<typeof PasswordForm>;

export const InfoForm = z.object({
  fullName: z.string().trim().min(1, "Nhập họ tên"),
  phone: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : v))
    .refine((v) => v === null || /^0[0-9]{9}$/.test(v), "Số điện thoại gồm 10 số, bắt đầu bằng 0"),
});
export type InfoFormValues = z.output<typeof InfoForm>;
