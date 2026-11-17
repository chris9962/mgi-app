import { z } from "zod";
import { CONTROL_CHAR_MESSAGE, noControlChar } from "./controlChars";

// Quà 20.000 đồng từ ngân hàng thứ hai (feedback 2026-11-16). Học sinh khai tài khoản nhận; nhân viên chuyển và đánh dấu trên trang quản lý.
export const GIFT_AMOUNT = 20_000;
export const GIFT_MIN_BANKS = 2;

const BAD = "Dữ liệu không hợp lệ.";

export const GiftForm = z.object(
  {
    bankId: z.uuid({ error: "Chọn ngân hàng nhận" }),
    // Số tài khoản hay gõ có dấu cách hoặc dấu chấm như cách đọc số.
    accountNumber: z
      .string({ error: "Nhập số tài khoản" })
      .transform((v) => v.replace(/[\s.]/g, ""))
      .pipe(z.string().regex(/^[0-9]{6,20}$/, "Số tài khoản gồm 6 tới 20 chữ số")),
    accountName: z
      .string({ error: "Nhập tên chủ tài khoản" })
      .transform((v) => v.trim().replace(/\s+/g, " "))
      .pipe(z.string().min(1, "Nhập tên chủ tài khoản").max(100, "Tối đa 100 ký tự").refine(noControlChar, CONTROL_CHAR_MESSAGE)),
  },
  { error: BAD },
);
export type GiftFormValues = z.output<typeof GiftForm>;
