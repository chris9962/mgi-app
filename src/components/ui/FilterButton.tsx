"use client";

import { clsx } from "clsx";
import { SlidersHorizontal } from "lucide-react";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { MOBILE_QUERY } from "@/lib/breakpoints";
import { Button } from "./Button";

export type FilterSection = { id: string; label: string; count: number; content: ReactNode };

// Bảng Bộ lọc như mgst-app: cột trái là mục lọc, cột phải là giá trị của mục đang chọn; chỉ một mục thì bỏ cột trái. Số đo chép FilterButton.module.css.
export function FilterButton({ sections, onClear }: { sections: FilterSection[]; onClear: () => void }) {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState(sections[0]?.id);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const paneId = useId();
  const active = sections.filter((s) => s.count > 0).length;
  const selected = sections.find((s) => s.id === picked) ?? sections[0];
  const split = sections.length > 1;

  // Dưới 900 px bảng có thể che nút Bộ lọc: đưa focus vào mục lọc đang chọn, không để focus nằm dưới bảng.
  function toggle() {
    if (open) return setOpen(false);
    flushSync(() => setOpen(true));
    if (matchMedia(MOBILE_QUERY).matches) (panel.current?.querySelector<HTMLElement>('[aria-current="true"]') ?? panel.current?.querySelector<HTMLElement>("input, button"))?.focus();
  }

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
      const target = e.target as Element;
      // Lịch chọn ngày vẽ qua portal, nằm ngoài bảng trong DOM: bấm vào lịch không phải bấm ra ngoài.
      if (target.closest?.("[data-radix-popper-content-wrapper]")) return;
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
    <div className="relative mobile:static">
      <Button
        ref={trigger}
        variant="secondary"
        aria-expanded={open}
        aria-controls={open ? paneId : undefined}
        // Đang lọc chỉ đổi sắc viền và chữ như mgst-app, không đeo số: dòng chip đã nói đang lọc gì. Dưới 900 px nút chỉ còn icon.
        // Dấu ! vì Tailwind xếp border-line, text-text của Button sau hai lớp này.
        className={clsx("mobile:h-9 mobile:w-9 mobile:px-0 pointer-coarse:min-w-11", active > 0 && "border-accent! text-accent-ink!")}
        onClick={toggle}
      >
        <SlidersHorizontal size={16} aria-hidden />
        <span className="mobile:sr-only">Bộ lọc</span>
      </Button>
      {/* Dưới 900 px neo bảng vào thanh tiêu đề: neo vào nút thì bảng 520 px tràn mép trái khi nút không sát mép phải.
          Màn thấp (dock): bảng đứng ngay trên thanh đáy, cao tối đa phần màn còn lại, treo dưới nút thì nút Xong rơi ra sau thanh đáy. */}
      {open && (
        <div
          ref={panel}
          className={clsx(
            "absolute top-full right-0 z-20 mt-2 flex flex-col overflow-hidden rounded-[14px] border border-line bg-card leading-[1.55] shadow-(--elev-lg) mobile:right-4 narrow:left-4 narrow:w-auto dock:fixed dock:top-auto dock:right-4 dock:bottom-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px)+8px)] dock:mt-0 dock:max-h-[calc(100svh-var(--bottom-nav-h)-env(safe-area-inset-bottom,0px)-16px)]",
            split ? "w-[min(520px,calc(100vw-32px))]" : "w-[min(400px,calc(100vw-32px))]",
          )}
        >
          {/* Màn hẹp không đủ chỗ cho cột mục lọc 168 px nên chuyển một cột như mgst-app. Màn thấp (dock) thì cao theo phần màn còn lại. */}
          <div
            className={
              split
                ? "grid h-[min(60dvh,420px)] grid-cols-[168px_1fr] grid-rows-[minmax(0,1fr)] narrow:h-[min(70dvh,520px)] narrow:grid-cols-1 narrow:grid-rows-[auto_minmax(0,1fr)] dock:h-auto dock:min-h-0 dock:flex-1"
                : "flex max-h-[min(60dvh,420px)] min-h-0 flex-col dock:flex-1"
            }
          >
            {split && (
              <nav aria-label="Mục lọc" className="flex flex-col gap-0.5 overflow-y-auto border-r border-line bg-panel p-2 narrow:flex-row narrow:items-center narrow:overflow-x-auto narrow:overflow-y-hidden narrow:border-r-0 narrow:border-b dock:min-h-0">
                {sections.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    aria-current={s.id === selected?.id ? "true" : undefined}
                    aria-controls={paneId}
                    onClick={() => setPicked(s.id)}
                    className={clsx(
                      "flex min-h-11 items-center justify-between gap-2 rounded-md px-2.5 text-left text-[13px] focus-visible:outline-offset-1 narrow:h-11 narrow:flex-none",
                      // Vạch cam ở mép là dấu hiệu thứ hai ngoài màu nền.
                      s.id === selected?.id ? "bg-accent-soft text-accent-ink shadow-[inset_3px_0_0_var(--accent)] narrow:shadow-[inset_0_-3px_0_var(--accent)]" : "text-text hover:bg-card",
                    )}
                  >
                    <span className="truncate">{s.label}</span>
                    {s.count > 0 && <span className="h-[18px] min-w-[18px] flex-none rounded-full bg-accent-soft px-[5px] text-center text-[11px] leading-[18px] font-semibold text-accent-ink">{s.count}</span>}
                  </button>
                ))}
              </nav>
            )}
            {/* Vùng giá trị tự cuộn: danh sách chọn, ô tìm trường và gợi ý của nó đều nằm trong luồng. */}
            <div id={paneId} role="region" aria-label={selected?.label} className="min-h-0 min-w-0 overflow-y-auto px-[18px] py-4">
              {selected?.content}
            </div>
          </div>
          <div className="flex flex-none items-center justify-between gap-3 border-t border-line px-[18px] pt-3 pb-4">
            <button
              type="button"
              disabled={active === 0}
              onClick={onClear}
              className="-my-[13px] px-0.5 py-[13px] text-[13px] text-accent-ink hover:underline disabled:cursor-not-allowed disabled:text-text-3 disabled:no-underline"
            >
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
