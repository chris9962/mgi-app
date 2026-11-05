"use client";

import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";

type Props = { open: boolean; title: string; onClose: () => void; footer?: ReactNode; children: ReactNode; width?: number };

export function Dialog({ open, title, onClose, footer, children, width = 480 }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  // Đồng bộ với API <dialog> của trình duyệt: showModal giữ focus trong hộp thoại và đóng bằng Esc.
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      style={{ width }}
      className="m-auto max-w-[calc(100vw-32px)] rounded-2xl border border-line bg-card p-0 text-text shadow-xl backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 id={titleId} className="text-[17px] font-semibold">
          {title}
        </h2>
        <button type="button" onClick={onClose} aria-label="Đóng" className="grid size-9 place-items-center rounded-lg border border-line text-text-2 hover:bg-surface">
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className="flex flex-col gap-4 px-5 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
    </dialog>
  );
}
