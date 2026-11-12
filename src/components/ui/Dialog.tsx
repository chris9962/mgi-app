"use client";

import { ChevronDown, X } from "lucide-react";
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";

// Như mgst-app: dismissible={false} ẩn nút Đóng và bỏ qua Esc, cho hộp đang gửi vì request đã đi thì đóng hộp không huỷ được.
type Props = { open: boolean; title: string; onClose: () => void; footer?: ReactNode; children: ReactNode; width?: number; dismissible?: boolean };

export function Dialog({ open, title, onClose, footer, children, width = 560, dismissible = true }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [canScrollDown, setCanScrollDown] = useState(false);
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

  // So đáy khối nội dung với đáy vùng cuộn, không dùng scrollHeight: scrollHeight cộng cả phần tràn của lớp phủ absolute bên trong.
  const checkScroll = useCallback(() => {
    const body = bodyRef.current;
    const content = contentRef.current;
    if (body && content) setCanScrollDown(content.getBoundingClientRect().bottom - body.getBoundingClientRect().bottom > 2);
  }, []);

  // Nội dung đổi cao sau khi mở (hiện lỗi, thêm ô): phải đo DOM thật mới biết còn cuộn được không.
  useEffect(() => {
    const body = bodyRef.current;
    const content = contentRef.current;
    if (!open || !body || !content) return;
    const observer = new ResizeObserver(checkScroll);
    observer.observe(body);
    observer.observe(content);
    return () => observer.disconnect();
  }, [open, checkScroll]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onCancel={(e) => {
        // Huỷ hộp chọn file hay chọn lại đúng file cũ cũng phát `cancel` từ ô file và nổi lên tới đây; chỉ Esc phát trên chính thẻ dialog.
        if (e.target !== e.currentTarget) return;
        e.preventDefault();
        if (dismissible) onClose();
      }}
      onClose={(e) => {
        if (closingByCode.current) closingByCode.current = false;
        else if (dismissible) onClose();
        // Chrome tự đóng ở lần Esc thứ ba liền hay khi bấm Back trên Android mà không phát cancel: mở lại cho khớp state của React.
        else e.currentTarget.showModal();
      }}
      style={{ width }}
      data-panel
      // Tên trường, tên ngân hàng liền một chữ dài hơn hộp: cho xuống hàng ở bất kỳ ký tự nào, không đẩy nút Đóng ra ngoài.
      // open:flex chứ không flex: đặt display thẳng lên thẻ thì đè display none lúc đóng.
      className="m-auto max-h-[calc(100dvh-64px)] max-w-[calc(100vw-32px)] flex-col overflow-hidden rounded-[14px] bg-bg p-0 text-text shadow-(--elev-lg) [overflow-wrap:anywhere] backdrop:bg-(--backdrop) open:flex"
    >
      <div className="flex flex-none items-center gap-3 px-5 pt-[18px] pb-3">
        <h2 id={titleId} className="min-w-0 flex-1 text-[19px] leading-[1.12] font-semibold tracking-[-0.015em]">
          {title}
        </h2>
        {dismissible && (
          <button type="button" onClick={onClose} aria-label="Đóng" className="-my-2.5 -mr-2.5 grid size-11 flex-none place-items-center rounded-full text-text-2 hover:bg-surface hover:text-text">
            <X size={18} aria-hidden />
          </button>
        )}
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col">
        {/* Hộp không có hàng nút thì nội dung tự chừa đáy bằng đệm của hàng nút. */}
        <div ref={bodyRef} onScroll={checkScroll} className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 ${footer ? "pb-1" : "pb-[18px]"}`}>
          <div ref={contentRef} className="flex flex-col gap-3.5 text-[15px] leading-[1.55]">
            {children}
          </div>
        </div>
        {canScrollDown && (
          <div aria-hidden className="pointer-events-none absolute bottom-1.5 left-1/2 grid size-[26px] -translate-x-1/2 place-items-center rounded-full border border-line bg-card text-text-2 shadow-(--elev-sm)">
            <ChevronDown size={16} />
          </div>
        )}
      </div>
      {footer && <div className="flex flex-none items-center justify-end gap-2.5 px-5 pt-3.5 pb-[18px]">{footer}</div>}
    </dialog>
  );
}
