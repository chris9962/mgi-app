import Image from "next/image";
import { BRAND_NAME } from "@/lib/brand";

export const metadata = { title: "Mở tài khoản" };

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-6">
      <header className="flex items-center gap-2 py-3">
        <Image src="/brand/logo.png" alt="" width={28} height={28} priority className="rounded-full" />
        <span className="text-[15px] font-semibold">{BRAND_NAME}</span>
      </header>
      <main className="flex flex-1 flex-col">{children}</main>
    </div>
  );
}
