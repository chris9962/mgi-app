import { UserRoundCheck } from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { Pager } from "@/components/ui/Pager";
import { SearchBox } from "@/components/ui/SearchBox";
import { DataTable, EmptyRow, TableHead } from "@/components/ui/DataTable";
import { AddUserButton } from "@/components/users/AddUserButton";
import { UserActions } from "@/components/users/UserActions";
import { bankText, formDefaults, permissionText, statusTag } from "@/components/users/userView";
import { ROLE_LABEL } from "@/lib/types";
import { readParam, type Params } from "@/lib/urlParams";
import { requirePage } from "@/server/auth/current";
import { listUsers, PAGE_SIZE } from "@/server/users";

export const metadata = { title: "Tài khoản" };

export default async function UsersPage({ searchParams }: { searchParams: Promise<Params> }) {
  const actor = await requirePage("users");
  const sp = await searchParams;
  const q = readParam(sp, "q");
  const { rows, total, page: current } = await listUsers({ q, page: Number(readParam(sp, "page")) || 1 });
  const href = (p: number) => `/users?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;
  const canGrantAdmin = actor.role === "admin";

  return (
    <>
      <TopBar
        title="Tài khoản"
        actions={
          <>
            <SearchBox action="/users" label="Tìm tài khoản" placeholder="Tìm tên, tên đăng nhập…" defaultValue={q} />
            <AddUserButton canGrantAdmin={canGrantAdmin} />
          </>
        }
      />
      <main className="p-6">
        <Card title="Tài khoản" icon={<UserRoundCheck size={17} aria-hidden />} meta={`${total} tài khoản`}>
          <DataTable caption="Tài khoản, vai, quyền, ngân hàng quản và trạng thái">
            <TableHead columns={["Tài khoản", "Vai", "Chức danh", "Quyền", "Ngân hàng quản", "Trạng thái", "Thao tác"]} />
            <tbody>
              {rows.map((u) => (
                <tr key={u.id}>
                  <td>
                    <Link href={`/users/${u.id}`} className="text-link hover:underline">
                      {u.fullName}
                    </Link>
                    <span className="block text-xs text-text-3">{u.username}</span>
                  </td>
                  <td>{ROLE_LABEL[u.role]}</td>
                  <td>{u.title}</td>
                  <td>{permissionText(u)}</td>
<td>{bankText(u)}</td>
                  <td>{statusTag(u)}</td>
                  <td>
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
                <EmptyRow colSpan={7}>
                  Không có tài khoản khớp từ khoá.
                </EmptyRow>
              )}
            </tbody>
          </DataTable>
          <Pager page={current} total={total} pageSize={PAGE_SIZE} href={href} />
        </Card>
      </main>
    </>
  );
}
