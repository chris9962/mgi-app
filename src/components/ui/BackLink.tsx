import { ChevronLeft } from "lucide-react";
import Link from "next/link";

// Chép BackLink của mgst-app: đứng đầu phần nội dung, đệm dọc 12 px bù bằng lề âm để vùng bấm cao 44 px. col-span-full cho trang xếp lưới.
export function BackLink({ href, children }: { href: string; children: string }) {
  return (
    <Link href={href} className="col-span-full -my-3 inline-flex items-center gap-[3px] self-start justify-self-start px-1 py-3 text-[13px] leading-[1.55] text-text-2 hover:text-accent-hover hover:underline">
      <ChevronLeft size={15} aria-hidden />
      {children}
    </Link>
  );
}
