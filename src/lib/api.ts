export type ApiResult<T> = { ok: true; data: T } | { ok: false; message: string; field?: string; status?: number };

// Gọi route của trang quản lý. Mất mạng thì fetch ném TypeError, bắt ở đây để giao diện luôn có câu báo lỗi.
export async function apiSend<T = null>(method: "POST" | "PATCH" | "PUT" | "DELETE", url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, {
      method,
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const data = res.status === 204 ? null : await res.json().catch(() => null);
    if (res.ok) return { ok: true, data: data as T };
    return { ok: false, message: data?.message ?? "Không lưu được. Thử lại sau ít phút.", field: data?.field, status: res.status };
  } catch {
    return { ok: false, message: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." };
  }
}
