import { X } from "lucide-react";
import Link from "next/link";

// Bộ lọc nằm trong bảng ẩn: chip cho thấy đang lọc gì và bỏ được ngay tại chỗ.
export function FilterChips({ chips }: { chips: { label: string; href: string }[] }) {
  if (!chips.length) return null;
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <span className="text-[13px] text-text-3">Đang lọc</span>
      {chips.map((c) => (
        <span key={c.label} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-1 pr-1.5 pl-3 text-[13px] font-semibold text-accent-ink">
          {c.label}
          <Link href={c.href} aria-label={`Bỏ lọc ${c.label}`} className="grid size-6 place-items-center rounded-full hover:bg-card">
            <X size={13} aria-hidden />
          </Link>
        </span>
      ))}
    </div>
  );
}
