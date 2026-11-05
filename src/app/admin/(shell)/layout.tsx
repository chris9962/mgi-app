import { requirePage } from "@/server/auth/current";
import { can } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/types";
import { MENU } from "@/components/shell/menu";
import { Sidebar } from "@/components/shell/Sidebar";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage();
  const groups = MENU.map((g) => ({ ...g, items: g.items.filter((i) => !i.action || can(user, i.action)) })).filter((g) => g.items.length);
  return (
    <div className="flex min-h-dvh">
      <Sidebar groups={groups} fullName={user.fullName} title={user.title || ROLE_LABEL[user.role]} />
      <div className="flex min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
