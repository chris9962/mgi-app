import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, tokenFromRequest, userFromToken } from "./session";
import { configuredHosts, sameOrigin } from "@/lib/hosts";
import { can, type Action } from "@/lib/permissions";
import { forbidden, unauthorized } from "../http/responses";
import type { SessionUser } from "@/lib/types";

export async function currentUser(): Promise<SessionUser | null> {
  return userFromToken((await cookies()).get(SESSION_COOKIE)?.value ?? null);
}

// Trang quản lý gọi hàm này đầu tiên: chưa đăng nhập thì về màn đăng nhập, thiếu quyền thì ra 404.
export async function requirePage(action?: Action): Promise<SessionUser> {
  const user = await currentUser();
  if (!user) redirect("/login");
  if (action && !can(user, action)) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}

// Trang mở theo điều kiện riêng, ví dụ người có quyền Quản lý ngân hàng hoặc được giao ít nhất một ngân hàng.
export async function requirePageWhere(allow: (user: SessionUser) => boolean): Promise<SessionUser> {
  const user = await requirePage();
  if (!allow(user)) {
    const { notFound } = await import("next/navigation");
    notFound();
  }
  return user;
}

export async function requireApi(
  request: Request,
  action?: Action,
): Promise<{ ok: true; user: SessionUser } | { ok: false; response: Response }> {
  if (!sameOrigin(request, configuredHosts().admin)) return { ok: false, response: forbidden() };
  const user = await userFromToken(tokenFromRequest(request));
  if (!user) return { ok: false, response: unauthorized() };
  if (action && !can(user, action)) return { ok: false, response: forbidden() };
  return { ok: true, user };
}
