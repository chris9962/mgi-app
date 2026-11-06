import { KeyRound, UserRoundCheck } from "lucide-react";
import { notFound } from "next/navigation";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { UserActions } from "@/components/users/UserActions";
import { bankText, formDefaults, statusTag } from "@/components/users/userView";
import { PERMISSION_LABEL, ROLE_LABEL } from "@/lib/types";
import { requirePage } from "@/server/auth/current";
import { isUuid } from "@/server/http/responses";
import { getUser } from "@/server/users";

export default async function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await requirePage("users");
  const { id } = await params;
  const user = isUuid(id) ? await getUser(id) : null;
  if (!user) notFound();
  const canGrantAdmin = actor.role === "admin";
  const info: [string, React.ReactNode][] = [
    ["Tên đăng nhập", user.username],
    ["Mã tài khoản", user.staffCode ?? <span className="text-text-3">Chưa có</span>],
    ["Vai", ROLE_LABEL[user.role]],
    ["Chức danh", user.title || <span className="text-text-3">Chưa có</span>],
    ["Số điện thoại", user.phone ?? <span className="text-text-3">Chưa có</span>],
    ["Ngân hàng quản", bankText(user)],
    ["Trạng thái", statusTag(user)],
  ];
  const perms = user.role !== "staff" ? ["Toàn quyền"] : user.permissions.map((p) => PERMISSION_LABEL[p]);

  return (
    <>
      <TopBar title={user.fullName} back={{ href: "/users", label: "Tài khoản" }} />
      <main className="grid gap-4 p-6 lg:grid-cols-[2fr_1fr]">
        <Card title="Tài khoản" icon={<UserRoundCheck size={17} aria-hidden />}>
          <dl className="mb-4 grid gap-3 sm:grid-cols-2">
            {info.map(([k, v]) => (
              <div key={k} className="flex flex-col gap-0.5">
                <dt className="text-[13px] text-text-2">{k}</dt>
                <dd className="text-sm wrap-anywhere">{v}</dd>
              </div>
            ))}
          </dl>
          <UserActions
            variant="detail"
            user={formDefaults(user)}
            canManage={canGrantAdmin || user.role !== "admin"}
            isSelf={user.id === actor.id}
            canGrantAdmin={canGrantAdmin}
          />
        </Card>
        <Card title="Quyền" icon={<KeyRound size={17} aria-hidden />} meta={user.role === "staff" ? `${perms.length} quyền` : undefined}>
          {perms.length ? (
            <ul className="flex list-disc flex-col gap-1.5 pl-5 text-sm">
              {perms.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-text-3">Chưa cấp quyền nào.</p>
          )}
        </Card>
      </main>
    </>
  );
}
