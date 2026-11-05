import { z } from "zod";

export const BankForm = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9]{2,10}$/, "Mã ngân hàng 2 tới 10 ký tự, chữ in hoa không dấu hoặc số"),
  name: z.string().trim().min(1, "Nhập tên ngân hàng"),
  sortOrder: z.coerce.number({ error: "Độ ưu tiên là số" }).int("Độ ưu tiên là số nguyên").min(0, "Độ ưu tiên từ 0 tới 999").max(999, "Độ ưu tiên từ 0 tới 999"),
  managerIds: z.array(z.uuid()).max(50),
});
export type BankFormValues = z.output<typeof BankForm>;

export const GuideSlot = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(1, "Nhập tên ảnh"),
  sampleKey: z.string().nullable(),
  checkName: z.boolean(),
  checkCode: z.boolean(),
});

export const GuideForm = z.object({
  steps: z.array(z.string().trim().min(1)).max(20, "Tối đa 20 bước"),
  slots: z.array(GuideSlot).min(1, "Cần ít nhất 1 ảnh cần nộp").max(10, "Tối đa 10 ảnh"),
});
export type GuideFormValues = z.output<typeof GuideForm>;
