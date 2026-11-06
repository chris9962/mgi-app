import { z } from "zod";
import { isImageKey } from "./imageKey";
import { blankAsNaN } from "./numberField";
import { CONTROL_CHAR_MESSAGE, noControlChar } from "./controlChars";

const optionalText = z
  .string()
  .trim()
  .refine(noControlChar, CONTROL_CHAR_MESSAGE)
  .transform((v) => (v === "" ? null : v));

export const CodeForm = z
  .object({
    bankId: z.uuid("Chọn ngân hàng"),
    displayName: z.string().trim().min(1, "Nhập tên hiển thị").refine(noControlChar, CONTROL_CHAR_MESSAGE),
    code: optionalText,
    qrKey: z.string().refine((k) => isImageKey(k, "qr"), "Ảnh QR không hợp lệ").nullable(),
    openUrl: optionalText.refine((v) => v === null || /^https?:\/\//i.test(v), "Link phải bắt đầu bằng http:// hoặc https://"),
    monthlyQuota: blankAsNaN(z.coerce.number({ error: "Số lượt là số" }).int("Số lượt là số nguyên").min(1, "Số lượt mỗi tháng lớn hơn 0").max(100000, "Số lượt tối đa 100.000")),
    priority: blankAsNaN(z.coerce.number({ error: "Độ ưu tiên là số" }).int("Độ ưu tiên là số nguyên").min(0, "Độ ưu tiên từ 0 tới 999").max(999, "Độ ưu tiên từ 0 tới 999")),
    schoolIds: z.array(z.uuid()).max(500),
  })
  .refine((v) => v.code !== null || v.qrKey !== null, { path: ["code"], message: "Nhập mã text hoặc chọn ảnh QR" });
export type CodeFormValues = z.output<typeof CodeForm>;
