"use client";

import { clsx } from "clsx";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { Button } from "./Button";

export type FilterSection = { id: string; label: string; count: number; content: ReactNode };

// Bảng Bộ lọc như mgst-app: cột trái là mục lọc, cột phải là giá trị của mục đang chọn.
export function FilterButton({ sections, onClear }: { sections: FilterSection[]; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(sections[0]?.id);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const paneId = useId();
  // Nút đếm số mục đang lọc như mgst-app; số giá trị chọn trong một mục hiện ở mục đó.
  const active = sections.filter((s) => s.count > 0).length;
  const selected = sections.find((s) => s.id === picked) ?? sections[0];

  // Nghe Esc và bấm ra ngoài trên document khi bảng mở; bỏ nghe khi bảng đóng.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // Ô bên trong đã dùng Esc (ô tìm đóng gợi ý) thì gọi preventDefault: bảng giữ nguyên.
      if (e.key !== "Escape" || e.defaultPrevented) return;
      setOpen(false);
      trigger.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [open]);

  return (
    <div className="relative narrow:static">
      <Button
        ref={trigger}
        variant="secondary"
        aria-expanded={open}
        aria-controls={open ? paneId : undefined}
        className={clsx(active > 0 && "border-accent text-accent-ink")}
        onClick={() => setOpen((v) => !v)}
      >
        <SlidersHorizontal size={16} aria-hidden />
        Bộ lọc
        {active > 0 && (
          <span className="min-w-5 rounded-full bg-accent px-1.5 text-xs leading-5 text-on-accent">
            {active}
            <span className="sr-only"> đang bật</span>
          </span>
        )}
      </Button>
      {open && (
        <div ref={panel} className="absolute top-full right-0 z-20 mt-2 flex w-[min(520px,calc(100vw-32px))] flex-col overflow-hidden rounded-2xl border border-line bg-card shadow-lg narrow:right-4 narrow:left-4 narrow:w-auto">
          {/* Màn hẹp như mgst-app: một cột, các mục lọc thành hàng cuộn ngang ở trên. */}
          <div className="grid min-h-[220px] grid-cols-[160px_1fr] narrow:grid-cols-1 narrow:grid-rows-[auto_minmax(0,1fr)]">
            <nav aria-label="Mục lọc" className="flex flex-col gap-0.5 border-r border-line bg-panel p-2 narrow:flex-row narrow:items-center narrow:overflow-x-auto narrow:border-r-0 narrow:border-b">
              {sections.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  aria-current={s.id === selected?.id ? "true" : undefined}
                  aria-controls={paneId}
                  onClick={() => setPicked(s.id)}
                  className={clsx(
                    "flex min-h-11 items-center justify-between gap-2 rounded-lg px-2.5 text-left text-[13px] narrow:flex-none narrow:whitespace-nowrap",
                    s.id === selected?.id ? "bg-accent-soft font-semibold text-accent-ink" : "hover:bg-surface",
                  )}
                >
                  {s.label}
                  {s.count > 0 && <span className="rounded-full bg-accent-soft px-1.5 text-[11px] font-semibold text-accent-ink">{s.count}</span>}
                </button>
              ))}
            </nav>
            <div id={paneId} role="region" aria-label={selected?.label} className="max-h-[min(60dvh,420px)] overflow-y-auto p-4">
              {selected?.content}
            </div>
          </div>
          <div className="flex items-center justify-between border-t border-line px-4 py-3">
            <button type="button" disabled={active === 0} onClick={onClear} className="text-[13px] text-accent-ink hover:underline disabled:cursor-not-allowed disabled:text-text-3 disabled:no-underline">
              Bỏ hết bộ lọc
            </button>
            <Button
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Xong
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
