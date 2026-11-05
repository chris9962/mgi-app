import { z } from "zod";

export const ResendForm = z.object({ toPhone: z.string({ error: "Nhập SĐT nhận" }).max(30, "SĐT phải có 10 số, bắt đầu bằng 0.") });
