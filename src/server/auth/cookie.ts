type Env = Record<string, string | undefined>;
export type CookieSettings = { name: string; secure: boolean };

// Tiền tố __Host- buộc trình duyệt chỉ nhận cookie có Secure, Path=/, không Domain: tên miền con khác không ghi đè được phiên.
// Trình duyệt bỏ cookie __Host- thiếu Secure, nên local chạy http và COOKIE_SECURE=false (chạy thật mà chưa có https) dùng tên thường.
export function cookieSettings(env: Env = process.env): CookieSettings {
  const secure = env.COOKIE_SECURE === "false" ? false : env.NODE_ENV === "production" || env.COOKIE_SECURE === "true";
  return { name: secure ? "__Host-mgi_session" : "mgi_session", secure };
}

export const sessionCookieHeader = (s: CookieSettings, token: string, maxAgeSeconds: number) =>
  `${s.name}=${token}; Path=/; HttpOnly; SameSite=Lax${s.secure ? "; Secure" : ""}; Max-Age=${maxAgeSeconds}`;
