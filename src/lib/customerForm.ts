import { z } from "zod";

const PHONE = "SĐT phải có 10 số, bắt đầu bằng 0.";

// Học sinh hay gõ SĐT có dấu cách hoặc dấu chấm như cách đọc số.
const phone = z
  .string()
  .transform((v) => v.replace(/[\s.]/g, ""))
  .pipe(z.string().regex(/^0[0-9]{9}$/, PHONE));

const name = (message: string) =>
  z
    .string()
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(1, message).max(100, "Tối đa 100 ký tự"));

export const CustomerForm = z
  .object({
    schoolId: z.uuid(),
    fullName: name("Nhập họ và tên"),
    className: z
      .string()
      .transform((v) => v.replace(/\s+/g, "").toUpperCase())
      .pipe(z.string().min(1, "Nhập lớp").max(20, "Tối đa 20 ký tự")),
    phone,
    parentName: name("Nhập họ và tên phụ huynh"),
    parentPhone: phone,
    existingBankIds: z.array(z.uuid()).max(50),
  })
  .refine((v) => v.phone !== v.parentPhone, { path: ["parentPhone"], message: "SĐT phụ huynh phải khác SĐT học sinh." });

export type CustomerFormInput = z.input<typeof CustomerForm>;
export type CustomerFormValues = z.output<typeof CustomerForm>;

export const BankChoiceForm = z.object({ bankIds: z.array(z.uuid()).min(1, "Chọn ngân hàng").max(2, "Chọn tối đa 2 ngân hàng") });

export const PhotoUploadForm = z.object({ customerBankId: z.uuid(), slotId: z.uuid(), contentType: z.string().max(100) });
export const PhotoRecordForm = z.object({ customerBankId: z.uuid(), slotId: z.uuid(), key: z.string().max(200) });
