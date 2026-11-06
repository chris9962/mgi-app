export type Params = URLSearchParams | Record<string, string | string[] | undefined>;

// Postgres từ chối ký tự NUL trong chuỗi và jsonb của audit, nên URL có %00 làm trang lỗi 500.
export const readParam = (sp: Params, key: string): string => {
  const v = sp instanceof URLSearchParams ? sp.get(key) : sp[key];
  return ((Array.isArray(v) ? v[0] : v) ?? "").replaceAll("\u0000", "");
};

const isDay = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;

export const readDay = (sp: Params, key: string): string => (isDay(readParam(sp, key)) ? readParam(sp, key) : "");

export const pickParam = <T extends string>(v: string, allowed: readonly T[]): T | "" => (allowed.includes(v as T) ? (v as T) : "");

// Ngày tính theo giờ Việt Nam: "đến 04/11" là tới 00:00 ngày 05/11 giờ Việt Nam.
export function dayRange(from: string, to: string): { start: Date | null; end: Date | null } {
  const start = from ? new Date(`${from}T00:00:00+07:00`) : null;
  const end = to ? new Date(new Date(`${to}T00:00:00+07:00`).getTime() + 24 * 3600 * 1000) : null;
  return { start, end };
}

export const queryOf = (values: Record<string, string>): string => new URLSearchParams(Object.entries(values).filter(([, v]) => v !== "")).toString();
