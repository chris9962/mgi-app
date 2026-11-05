export type Hosts = { admin: string; student: string };

export type Route = { kind: "next" } | { kind: "rewrite"; path: string } | { kind: "notFound" };

export const configuredHosts = (): Hosts => ({
  admin: (process.env.ADMIN_HOST ?? "admin.localhost").toLowerCase(),
  student: (process.env.STUDENT_HOST ?? "bank.localhost").toLowerCase(),
});

const INTERNAL = /^\/(admin|student)(\/|$)/;

// Hai tên miền dùng chung một app: trang của mỗi bên nằm ở thư mục riêng, API quản lý chỉ mở trên tên miền quản lý.
export function routeFor(host: string | null, path: string, hosts: Hosts): Route {
  const name = (host ?? "").split(":")[0].toLowerCase();
  const side = name === hosts.admin ? "admin" : name === hosts.student ? "student" : null;
  if (!side || INTERNAL.test(path)) return { kind: "notFound" };

  if (path === "/api" || path.startsWith("/api/")) {
    const adminApi = path.startsWith("/api/admin/") || path === "/api/admin";
    return adminApi === (side === "admin") ? { kind: "next" } : { kind: "notFound" };
  }

  return { kind: "rewrite", path: path === "/" ? `/${side}` : `/${side}${path}` };
}

// Chặn request ghi gửi từ trang khác. Web học sinh cùng site với trang quản lý nên SameSite=Lax không đủ chặn.
export function sameOrigin(request: Request, adminHost: string): boolean {
  if (request.method === "GET" || request.method === "HEAD") return true;
  const origin = request.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).hostname.toLowerCase() === adminHost;
    } catch {
      return false;
    }
  }
  return request.headers.get("sec-fetch-site") === "same-origin";
}
