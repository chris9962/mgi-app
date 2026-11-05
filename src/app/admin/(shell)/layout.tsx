import { requirePage } from "@/server/auth/current";
import { failedSmsCount } from "@/server/sms/queue";
import { can } from "@/lib/permissions";
import { ROLE_LABEL } from "@/lib/types";
import { menuFor } from "@/components/shell/menu";
import { AppShell } from "@/components/shell/AppShell";

export default async function ShellLayout({ children }: { children: React.ReactNode }) {
  const user = await requirePage();
  const groups = menuFor(user, can(user, "customers") ? { "/sms": await failedSmsCount(user) } : {});
  return (
    <AppShell groups={groups} fullName={user.fullName} title={user.title || ROLE_LABEL[user.role]}>
      {children}
    </AppShell>
  );
}
