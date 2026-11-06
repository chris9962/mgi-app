"use client";

import { X } from "lucide-react";
import { useId, useLayoutEffect, useRef, type ReactNode } from "react";

type Props = { open: boolean; title: string; onClose: () => void; footer?: ReactNode; children: ReactNode; width?: number };

export function Dialog({ open, title, onClose, footer, children, width = 480 }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const closingByCode = useRef(false);
  const titleId = useId();

  // Đồng bộ với API <dialog> của trình duyệt: showModal giữ focus trong hộp thoại và đóng bằng Esc.
  // Layout effect để phần dọn chạy trước khi React gỡ phần tử: gỡ một <dialog> đang mở thì trình duyệt không trả focus.
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !open) return;
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (!el.open) el.showModal();
    // showModal tự focus nút Đóng; ô có data-autofocus thì focus ô đó.
    el.querySelector<HTMLElement>("[data-autofocus]")?.focus();
    return () => {
      // close() phát sự kiện close; đánh dấu để onClose bỏ qua, không thì lần dọn của React dev đóng luôn hộp thoại vừa mở.
      if (el.open) {
        closingByCode.current = true;
        el.close();
      }
      if (opener?.isConnected) opener.focus();
    };
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={() => {
        if (closingByCode.current) closingByCode.current = false;
        else onClose();
      }}
      style={{ width }}
      // Tên trường, tên ngân hàng liền một chữ dài hơn hộp: cho xuống hàng ở bất kỳ ký tự nào, không đẩy nút Đóng ra ngoài.
      className="m-auto max-w-[calc(100vw-32px)] rounded-2xl border border-line bg-card p-0 text-text shadow-xl [overflow-wrap:anywhere] backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-4">
        <h2 id={titleId} className="min-w-0 text-[17px] font-semibold">
          {title}
        </h2>
        <button type="button" onClick={onClose} aria-label="Đóng" className="grid size-9 flex-none place-items-center rounded-lg border border-line text-text-2 hover:bg-surface">
          <X size={16} aria-hidden />
        </button>
      </div>
      <div className="flex flex-col gap-4 px-5 py-5">{children}</div>
      {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div>}
    </dialog>
  );
}
