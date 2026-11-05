import { redirect } from "next/navigation";
import { currentUser } from "@/server/auth/current";
import { BrandPanel } from "@/components/brand/BrandPanel";
import { Logo } from "@/components/ui/Logo";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Đăng nhập - Minh Group ST" };

export default async function LoginPage() {
  if (await currentUser()) redirect("/");
  return (
    <main className="flex min-h-dvh bg-bg">
      <div className="flex flex-[4] flex-col justify-center px-5 py-8 md:px-10 md:py-14">
        <div className="mx-auto flex w-full max-w-[380px] flex-col gap-6">
          <Logo size={44} withAppName priority />
          <h1 className="text-[38px] font-semibold">Đăng nhập</h1>
          <LoginForm />
        </div>
      </div>
      <BrandPanel />
    </main>
  );
}
