import { TopBar } from "@/components/shell/TopBar";
import { ChangePasswordRow, EditInfoRow } from "@/components/profile/ProfileActions";
import { ROLE_LABEL } from "@/lib/types";
import { requirePage } from "@/server/auth/current";

export const metadata = { title: "Cá nhân" };

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="px-1 text-[13px] font-semibold text-text-2">{title}</h2>
      <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">{children}</div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex min-h-12 items-center justify-between gap-4 px-4 text-sm">
      <span className="text-text-2">{label}</span>
      <b className="min-w-0 text-right font-semibold wrap-anywhere">{value}</b>
    </div>
  );
}

export default async function ProfilePage() {
  const user = await requirePage();
  return (
    <>
      <TopBar title="Cá nhân" />
      <main className="flex max-w-[560px] flex-col gap-6 p-6">
        <Group title="Thông tin cá nhân">
          <Row label="Họ tên" value={user.fullName} />
          <Row label="Tên đăng nhập" value={user.username} />
          <Row label="Số điện thoại" value={user.phone ?? <span className="font-normal text-text-3">Chưa có</span>} />
          <Row label="Chức danh" value={user.title || ROLE_LABEL[user.role]} />
          <EditInfoRow fullName={user.fullName} phone={user.phone ?? ""} />
        </Group>
        <Group title="Bảo mật">
          <ChangePasswordRow />
        </Group>
      </main>
    </>
  );
}
