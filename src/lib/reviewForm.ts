import { z } from "zod";
import { CONTROL_CHAR_MESSAGE, wellFormed } from "./controlChars";

export const ReviewForm = z.object({
  result: z.enum(["passed", "failed"], { error: "Chọn Đạt hoặc Không đạt." }),
  // Trạng thái người kiểm thấy lúc mở trang: máy chủ chỉ ghi khi dòng vẫn ở trạng thái đó.
  expected: z.enum(["selected", "pending", "passed", "failed"], { error: "Dữ liệu không hợp lệ." }),
  // Ảnh người kiểm thấy lúc mở trang: Đạt chỉ ghi khi ảnh đang dùng vẫn là các ảnh đó.
  photos: z.array(z.uuid({ error: "Dữ liệu không hợp lệ." })).max(50).optional(),
});

export const NoteForm = z.object({
  note: z
    .string({ error: "Dữ liệu không hợp lệ." })
    .trim()
    .max(1000, "Ghi chú tối đa 1000 ký tự")
    .refine((v) => !/[\u0000-\u0009\u000b-\u001f\u007f]/.test(v) && wellFormed(v), CONTROL_CHAR_MESSAGE),
});
