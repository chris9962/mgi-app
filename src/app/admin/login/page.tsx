import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/current";
import { BrandPanel } from "@/components/brand/BrandPanel";
import { Logo } from "@/components/ui/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Đăng nhập" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return (
    <main className="flex min-h-dvh bg-bg [--field-border:var(--line)]">
      <div className="flex flex-[4] flex-col justify-center px-10 py-14 mobile:px-5 mobile:py-8">
        <div className="mx-auto flex w-full max-w-[380px] flex-col gap-[17.6px]">
          <Logo size={44} withAppName priority />
          <h1 className="text-[38px] leading-[1.12] font-semibold tracking-[-0.015em]">Đăng nhập</h1>
          <LoginForm />
        </div>
      </div>
      <BrandPanel />
    </main>
  );
}
