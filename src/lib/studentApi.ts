import { readDevice } from "./studentDevice";

export type StudentResult<T> = { ok: true; data: T } | { ok: false; status: number; message: string; field?: string };

// Học sinh không có cookie: token trên máy đi trong header Authorization.
export async function studentApi<T = null>(method: "GET" | "POST" | "DELETE", url: string, body?: unknown): Promise<StudentResult<T>> {
  const { token } = readDevice(localStorage);
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  // FormData tự đặt Content-Type kèm boundary của multipart.
  const form = body instanceof FormData;
  if (body !== undefined && !form) headers["Content-Type"] = "application/json";
  try {
    const res = await fetch(url, { method, headers, body: body === undefined ? undefined : form ? body : JSON.stringify(body), cache: "no-store" });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: data as T };
    return { ok: false, status: res.status, message: data?.message ?? "Không lưu được. Thử lại sau ít phút.", field: data?.field };
  } catch {
    return { ok: false, status: 0, message: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." };
  }
}
