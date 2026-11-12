"use client";

import * as Popover from "@radix-ui/react-popover";
import { clsx } from "clsx";
import { format } from "date-fns";
import { vi } from "date-fns/locale";
import { useId, useRef, useState, useSyncExternalStore, type CSSProperties } from "react";
import { DayPicker, type DateRange } from "react-day-picker";
import "react-day-picker/style.css";
import { inputClass } from "./Field";

export type { DateRange };

type Props = { value: DateRange | undefined; onChange: (range: DateRange | undefined) => void; label: string; hideLabel?: boolean; maxDate?: Date };

const show = (r: DateRange | undefined) => {
  if (!r?.from) return "Chọn khoảng ngày";
  const from = format(r.from, "dd/MM/yyyy");
  if (!r.to) return `${from} → …`;
  const to = format(r.to, "dd/MM/yyyy");
  return from === to ? from : `${from} → ${to}`;
};

const NARROW = "(max-width: 600px)";

function useNarrowViewport() {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(NARROW);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(NARROW).matches,
    () => false,
  );
}

const CALENDAR = {
  "--rdp-accent-color": "var(--accent)",
  "--rdp-accent-background-color": "var(--accent-soft)",
  "--rdp-today-color": "var(--accent-ink)",
  "--rdp-day-height": "34px",
  "--rdp-day-width": "34px",
  "--rdp-day_button-height": "34px",
  "--rdp-day_button-width": "34px",
  "--rdp-day_button-border-radius": "999px",
  "--rdp-range_start-color": "var(--on-accent)",
  "--rdp-range_end-color": "var(--on-accent)",
  "--rdp-range_middle-background-color": "var(--accent-soft)",
  "--rdp-range_middle-color": "var(--accent-ink)",
  "--rdp-selected-border": "none",
  fontSize: 13,
  margin: 0,
} as CSSProperties;

// Chép DateRangePicker của mgst-app: một lịch, bấm ngày đầu rồi ngày cuối. Không chép luật khoá trong một tháng: luật đó của KPI theo tháng, mgi-bank lọc theo ngày tạo.
export function DateRangePicker({ value, onChange, label, hideLabel = false, maxDate = new Date() }: Props) {
  const id = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const narrow = useNarrowViewport();
  const [open, setOpen] = useState(false);
  // Ngày đầu đang chọn dở giữ ở đây, chưa báo ra ngoài: báo ngay thì trang lọc "từ ngày đó trở đi" và tải thừa một lượt.
  const [picking, setPicking] = useState<Date | null>(null);

  function change(next: boolean) {
    setOpen(next);
    if (!next) setPicking(null);
  }

  return (
    <Popover.Root open={open} onOpenChange={change}>
      <span className="flex w-full flex-col gap-1.5">
        {/* Bấm nhãn không mở lịch: lịch đang mở mà bấm lên trên để đóng thì chạm nhãn là lịch mở lại. Vẫn giữ htmlFor cho trình đọc màn hình. */}
        <label
          htmlFor={id}
          className={hideLabel ? "sr-only" : "text-[13px] text-text-2"}
          onMouseDown={(e) => {
            e.preventDefault();
            triggerRef.current?.blur();
          }}
          onClick={(e) => e.preventDefault()}
        >
          {label}
        </label>
        <Popover.Trigger ref={triggerRef} id={id} className={clsx(inputClass, "cursor-pointer text-left whitespace-nowrap")}>
          {show(value)}
        </Popover.Trigger>
      </span>
      <Popover.Portal>
        <Popover.Content
          sideOffset={6}
          align={narrow ? "center" : "end"}
          // Esc chỉ đóng lịch: preventDefault để bảng Bộ lọc bên ngoài không đóng theo.
          onEscapeKeyDown={(e) => {
            e.preventDefault();
            change(false);
            triggerRef.current?.focus();
          }}
          className="z-30 max-h-[calc(100dvh-32px)] max-w-[calc(100vw-32px)] overflow-y-auto rounded-[14px] border border-line bg-bg p-[13.2px] text-text shadow-(--elev-lg)"
        >
          <DayPicker
            mode="range"
            locale={vi}
            numberOfMonths={narrow ? 1 : 2}
            defaultMonth={value?.from}
            selected={picking ? { from: picking, to: undefined } : value}
            // Đã có khoảng đủ hai đầu thì lượt bấm kế tiếp mở khoảng mới, không nối dài khoảng cũ.
            resetOnSelect
            onSelect={(range) => {
              if (range?.from && !range.to) return setPicking(range.from);
              setPicking(null);
              onChange(range);
            }}
            disabled={{ after: maxDate }}
            style={CALENDAR}
            className="[&_.rdp-month_caption]:text-[15px]"
          />
          <Popover.Arrow className="fill-bg" />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
