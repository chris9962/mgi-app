import { TopBar } from "@/components/shell/TopBar";
import { SettingsForm } from "@/components/settings/SettingsForm";
import { requirePage } from "@/server/auth/current";
import { getSettings } from "@/server/settings";

export const metadata = { title: "Cài đặt" };

export default async function SettingsPage() {
  await requirePage("system");
  return (
    <>
      <TopBar title="Cài đặt" />
      <main className="p-6">
        <SettingsForm initial={await getSettings()} />
      </main>
    </>
  );
}
