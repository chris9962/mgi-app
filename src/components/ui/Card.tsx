import type { ReactNode } from "react";

export function Card({ title, icon, meta, action, children, pad = true }: { title: string; icon?: ReactNode; meta?: ReactNode; action?: ReactNode; children: ReactNode; pad?: boolean }) {
  return (
    <section className="rounded-2xl border border-line bg-card shadow-sm">
      <header className="flex items-center gap-2.5 border-b border-line px-4 py-3.5">
        {icon && <span className="text-accent">{icon}</span>}
        <h2 className="text-[15px] font-semibold">{title}</h2>
        {meta && <span className="text-[13px] text-text-3">{meta}</span>}
        {action && <div className="ml-auto flex gap-2">{action}</div>}
      </header>
      <div className={pad ? "p-4" : undefined}>{children}</div>
    </section>
  );
}
