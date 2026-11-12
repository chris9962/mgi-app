import { X } from "lucide-react";
import Link from "next/link";

// Bộ lọc nằm trong bảng ẩn: chip cho thấy đang lọc gì và bỏ được ngay tại chỗ.
// Số đo chép FilterChips.module.css của mgst-app; màu giữ cặp accent-soft, accent-ink vì cặp chip của mgst không đạt 4,5:1.
export function FilterChips({ chips }: { chips: { label: string; href: string }[] }) {
  if (!chips.length) return null;
  return (
    <div className="mb-[17.6px] flex flex-wrap items-center gap-2 leading-[1.55]">
      <span className="text-[12.5px] text-text-3">Đang lọc</span>
      {chips.map((c) => (
        <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-[5px] pr-1.5 pl-[11px] text-[12.5px] font-semibold text-accent-ink">
          {c.label}
          <Link
            href={c.href}
            aria-label={`Bỏ lọc ${c.label}`}
            className="relative grid size-[18px] place-items-center rounded-full after:absolute after:top-1/2 after:left-1/2 after:size-11 after:-translate-1/2 hover:bg-accent-ink/18 focus-visible:outline-offset-1"
          >
            <X size={13} aria-hidden />
          </Link>
        </span>
      ))}
    </div>
  );
}
