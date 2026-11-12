import { useLayoutEffect, useRef } from "react";

// Danh sách thả đặt position fixed theo ô nhập: nằm trong thân hộp thoại hay bảng Bộ lọc có overflow thì danh sách absolute bị cắt, phải cuộn mới thấy.
// Ghi thẳng style lên phần tử: vị trí là số đo DOM, đổi theo từng lần cuộn, không phải state của React.
export function useFloatingList<A extends HTMLElement, L extends HTMLElement>(open: boolean, maxHeight: number) {
  const anchor = useRef<A>(null);
  const list = useRef<L>(null);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchor.current;
      const l = list.current;
      if (!a || !l) return;
      const r = a.getBoundingClientRect();
      const below = window.innerHeight - r.bottom - 12;
      const above = r.top - 12;
      // Dưới ô không đủ chỗ cho khoảng 4 dòng mà phía trên rộng hơn thì mở lên trên.
      const up = below < Math.min(maxHeight, 160) && above > below;
      Object.assign(l.style, {
        left: `${r.left}px`,
        width: `${r.width}px`,
        maxHeight: `${Math.max(80, Math.min(maxHeight, up ? above : below))}px`,
        top: up ? "auto" : `${r.bottom + 4}px`,
        bottom: up ? `${window.innerHeight - r.top + 4}px` : "auto",
      });
    };
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, maxHeight]);
  return [anchor, list] as const;
}
