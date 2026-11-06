import { z } from "zod";
import { isImageKey } from "./imageKey";
import { blankAsNaN } from "./numberField";
import { CONTROL_CHAR_MESSAGE, noControlChar } from "./controlChars";

export const BankForm = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "Mã ngân hàng 2 tới 10 ký tự, chữ in hoa không dấu hoặc số"),
  name: z.string().trim().min(1, "Nhập tên ngân hàng").refine(noControlChar, CONTROL_CHAR_MESSAGE),
  sortOrder: blankAsNaN(z.coerce.number({ error: "Độ ưu tiên là số" }).int("Độ ưu tiên là số nguyên").min(0, "Độ ưu tiên từ 0 tới 999").max(999, "Độ ưu tiên từ 0 tới 999")),
  managerIds: z.array(z.uuid()).max(50),
});
export type BankFormValues = z.output<typeof BankForm>;

export const GuideSlot = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Nhập tên ảnh").refine(noControlChar, CONTROL_CHAR_MESSAGE),
  sampleKey: z.string().refine((k) => isImageKey(k, "samples"), "Ảnh mẫu không hợp lệ").nullable(),
  checkName: z.boolean(),
  checkCode: z.boolean(),
});

export const GuideForm = z.object({
  steps: z.array(z.string().trim().min(1).refine(noControlChar, CONTROL_CHAR_MESSAGE)).max(20, "Tối đa 20 bước"),
  slots: z.array(GuideSlot).min(1, "Cần ít nhất 1 ảnh cần nộp").max(10, "Tối đa 10 ảnh"),
  // Khung ảnh người sửa thấy lúc mở hộp: máy chủ chỉ lưu khi bộ khung vẫn như vậy.
  seenSlotIds: z.array(z.uuid()).max(10),
});
export type GuideFormValues = z.output<typeof GuideForm>;
