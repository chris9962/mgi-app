import { z } from "zod";

const PHONE = "SĐT phải có 10 số, bắt đầu bằng 0.";
// Học sinh thấy câu lỗi của máy chủ: mọi câu phải là tiếng Việt, không để câu mặc định tiếng Anh của zod lọt ra.
const BAD = "Dữ liệu không hợp lệ.";
// NUL làm Postgres báo lỗi 500; ký tự điều khiển khác không có chỗ trong họ tên hay lớp.
const CONTROL = /[\u0000-\u001f\u007f]/;

const uuid = () => z.uuid({ error: BAD });

// Học sinh hay gõ SĐT có dấu cách hoặc dấu chấm như cách đọc số.
const phone = z
  .string({ error: PHONE })
  .transform((v) => v.replace(/[\s.]/g, ""))
  .pipe(z.string().regex(/^0[0-9]{9}$/, PHONE));

const name = (message: string) =>
  z
    .string({ error: message })
    .transform((v) => v.trim().replace(/\s+/g, " "))
    .pipe(
      z
        .string()
        .min(1, message)
        .max(100, "Tối đa 100 ký tự")
        .refine((v) => !CONTROL.test(v), "Có ký tự không hợp lệ"),
    );

const info = {
  fullName: name("Nhập họ và tên"),
  className: z
    .string({ error: "Nhập lớp" })
    .transform((v) => v.replace(/\s+/g, "").toUpperCase())
    .pipe(
      z
        .string()
        .min(1, "Nhập lớp")
        .max(20, "Tối đa 20 ký tự")
        .refine((v) => !CONTROL.test(v), "Có ký tự không hợp lệ"),
    ),
  phone,
  parentName: name("Nhập họ và tên phụ huynh"),
  parentPhone: phone,
};

const phonesDiffer = (v: { phone: string; parentPhone: string }) => v.phone !== v.parentPhone;
const PHONES_DIFFER = { path: ["parentPhone"], message: "SĐT phụ huynh phải khác SĐT học sinh." };

export const CustomerForm = z
  .object({ schoolId: uuid(), ...info, existingBankIds: z.array(uuid(), { error: BAD }).max(50, BAD) }, { error: BAD })
  .refine(phonesDiffer, PHONES_DIFFER);

// Người quản ngân hàng sửa thông tin khai ở B1; trường và ngân hàng đã có không đổi được.
export const CustomerEditForm = z.object(info, { error: BAD }).refine(phonesDiffer, PHONES_DIFFER);
export type CustomerEditValues = z.output<typeof CustomerEditForm>;

export type CustomerFormInput = z.input<typeof CustomerForm>;
export type CustomerFormValues = z.output<typeof CustomerForm>;

export const BankChoiceForm = z.object(
  { bankIds: z.array(uuid(), { error: "Chọn ngân hàng" }).min(1, "Chọn ngân hàng").max(2, "Chọn tối đa 2 ngân hàng") },
  { error: BAD },
);

export const PhotoTargetForm = z.object({ customerBankId: uuid(), slotId: uuid() }, { error: BAD });
