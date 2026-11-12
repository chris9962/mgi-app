import Link from "next/link";
import { monthLabel, shiftMonth } from "@/lib/month";

// Cùng dáng nút phụ của Button: mgst-app dùng Button secondary với chữ ‹ và ›.
const btn = "inline-flex items-center justify-center rounded-[10px] border border-line px-[15.84px] py-[8.8px] text-sm leading-[1.2] font-semibold text-text hover:bg-text/7 active:bg-text/14 pointer-coarse:min-h-11";

// Ô chọn tháng như MonthPicker của mgst-app: hai nút lùi, tiến và nhãn tháng; tháng nằm trên URL để lọc ở máy chủ.
export function MonthPicker({ month, href }: { month: string; href: (month: string) => string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Link href={href(shiftMonth(month, -1))} className={btn} aria-label="Tháng trước">
        <span aria-hidden>‹</span>
      </Link>
      <span className="min-w-[118px] text-center text-[13px] tabular-nums" aria-live="polite">
        {monthLabel(month)}
      </span>
      <Link href={href(shiftMonth(month, 1))} className={btn} aria-label="Tháng sau">
        <span aria-hidden>›</span>
      </Link>
    </span>
  );
}
