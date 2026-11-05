import { Search, UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { AddUserButton } from "@/components/users/AddUserButton";
import { UserActions } from "@/components/users/UserActions";
import { bankText, formDefaults, permissionText, statusTag } from "@/components/users/userView";
import { ROLE_LABEL } from "@/lib/types";
import { requirePage } from "@/server/auth/current";
import { listUsers, PAGE_SIZE } from "@/server/users";

export const metadata = { title: "Tài khoản" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const actor = await requirePage("users");
  const { q = "", page = "1" } = await searchParams;
  const { rows, total, page: current } = await listUsers({ q, page: Number(page) || 1 });
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const from = total ? (current - 1) * PAGE_SIZE + 1 : 0;
  const to = Math.min(total, current * PAGE_SIZE);
  const href = (p: number) => `/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;
  const canGrantAdmin = actor.role === "admin";

  return (
    <>
      <TopBar
        title="Tài khoản"
        actions={
          <>
            <form role="search" action="/users" className="relative">
              <Search size={16} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-3" />
              <label htmlFor="user-search" className="sr-only">
                Tìm tài khoản
              </label>
              <input
                id="user-search"
                name="q"
                defaultValue={q}
                placeholder="Tìm tên, tên đăng nhập…"
                className="h-9 w-64 rounded-[10px] border border-field-border bg-card pr-3 pl-9 text-sm placeholder:text-text-3"
              />
            </form>
            <AddUserButton canGrantAdmin={canGrantAdmin} />
          </>
        }
      />
      <main className="p-6">
        <Card title="Tài khoản" icon={<UserRoundCheck size={17} aria-hidden />} meta={`${total} tài khoản`} pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-semibold tracking-wide text-text-2 uppercase">
                <tr className="border-b border-line">
                  {["Tài khoản", "Vai", "Chức danh", "Quyền", "Ngân hàng quản", "Trạng thái", "Thao tác"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((u) => (
                  <tr key={u.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3">
                      <Link href={`/users/${u.id}`} className="text-link hover:underline">
                        {u.fullName}
                      </Link>
                      <span className="block text-xs text-text-3">{u.username}</span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">{ROLE_LABEL[u.role]}</td>
                    <td className="px-4 py-3">{u.title}</td>
                    <td className="px-4 py-3">{permissionText(u)}</td>
                    <td className="px-4 py-3">{bankText(u)}</td>
                    <td className="px-4 py-3">{statusTag(u)}</td>
                    <td className="px-4 py-3">
                      <UserActions
                        variant="row"
                        user={formDefaults(u)}
                        canManage={canGrantAdmin || u.role !== "admin"}
                        isSelf={u.id === actor.id}
                        canGrantAdmin={canGrantAdmin}
                      />
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-text-3">
                      Không có tài khoản khớp từ khoá.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <nav aria-label="Phân trang" className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-text-2">
            <span>
              {from}–{to} trên {total}
            </span>
            <span className="flex items-center gap-3">
              {current > 1 ? (
                <Link href={href(current - 1)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface">
                  Trước
                </Link>
              ) : null}
              <span>
                {current} / {pages}
              </span>
              {current < pages ? (
                <Link href={href(current + 1)} className="rounded-lg border border-line px-3 py-1.5 hover:bg-surface">
                  Sau
                </Link>
              ) : null}
            </span>
          </nav>
        </Card>
      </main>
    </>
  );
}
