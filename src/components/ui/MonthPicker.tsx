import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { monthLabel, shiftMonth } from "@/lib/month";

const btn = "grid size-9 place-items-center rounded-[10px] border border-line bg-card text-text-2 hover:bg-surface hover:text-text";

// Ô chọn tháng như MonthPicker của mgst-app: hai nút lùi, tiến và nhãn tháng; tháng nằm trên URL để lọc ở máy chủ.
export function MonthPicker({ month, href }: { month: string; href: (month: string) => string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Link href={href(shiftMonth(month, -1))} className={btn} aria-label="Tháng trước">
        <ChevronLeft size={16} aria-hidden />
      </Link>
      <span className="min-w-[120px] text-center text-sm font-semibold" aria-live="polite">
        {monthLabel(month)}
      </span>
      <Link href={href(shiftMonth(month, 1))} className={btn} aria-label="Tháng sau">
        <ChevronRight size={16} aria-hidden />
      </Link>
    </span>
  );
}
