import type { ReactNode } from "react";

export function Card({ title, icon, meta, action, children }: { title: string; icon?: ReactNode; meta?: ReactNode; action?: ReactNode; children?: ReactNode }) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-[13.2px] rounded-[14px] border border-line bg-card p-[17.6px] shadow-card">
      <header className="flex flex-wrap items-center gap-2.5">
        {icon && (
          <span aria-hidden className="grid size-[30px] flex-none place-items-center rounded-md bg-chip-bg text-chip-ink">
            {icon}
          </span>
        )}
        <h2 className="flex-1 text-[15px] leading-[1.12] font-semibold tracking-[-0.015em]">{title}</h2>
        {meta && <span className="text-[11.5px] text-text-3">{meta}</span>}
        {action && (
          <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-[8.8px] narrow:ml-0 narrow:basis-full narrow:justify-start [span+&]:border-l [span+&]:border-line [span+&]:pl-[13.2px] narrow:[span+&]:border-l-0 narrow:[span+&]:pl-0">
            {action}
          </div>
        )}
      </header>
      {children}
    </section>
  );
}
