import { z } from "zod";

// Ô số bỏ trống thành NaN để báo lỗi của ô như numberValue của mgst-app; z.coerce.number lặng lẽ đổi chuỗi rỗng thành 0.
export const blankAsNaN = <T extends z.ZodType>(schema: T) => z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? Number.NaN : v), schema);
