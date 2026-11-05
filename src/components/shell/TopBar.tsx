import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";

export function TopBar({ title, back, actions }: { title: string; back?: { href: string; label: string }; actions?: ReactNode }) {
  return (
    <header className="flex min-h-[68px] flex-wrap items-center gap-3 border-b border-line bg-bg px-6 py-3">
      {back && (
        <>
          <Link href={back.href} className="inline-flex items-center gap-1.5 text-sm text-text-2 hover:text-text">
            <ArrowLeft size={16} aria-hidden />
            {back.label}
          </Link>
          <span aria-hidden className="h-5 w-px bg-line" />
        </>
      )}
      <h1 className="text-xl font-semibold">{title}</h1>
      {actions && <div className="ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
