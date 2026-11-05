// Một mục của photo_checks.result: khung có bật kiểm, giá trị hệ thống đem đi tìm, đạt hay không và câu lý do. Worker giai đoạn 6 ghi đúng dạng này.
export type PhotoCheckItem = { slotId: string; slotName: string; expected: string; passed: boolean; reason: string };

export type PhotoCheckView = { status: "pending" | "done" | "failed"; checkedAt: string | null; passed: number; total: number; error: string; items: PhotoCheckItem[] };

const isItem = (v: unknown): v is PhotoCheckItem => {
  const o = v as Record<string, unknown>;
  return Boolean(o) && typeof o.slotName === "string" && typeof o.expected === "string" && typeof o.passed === "boolean" && typeof o.reason === "string";
};

// jsonb do worker ghi: mục sai dạng thì bỏ, không làm hỏng trang chi tiết.
export const checkItems = (result: unknown): PhotoCheckItem[] => (Array.isArray(result) ? result.filter(isItem) : []);
