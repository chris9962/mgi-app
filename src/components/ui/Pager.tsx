import Link from "next/link";

const button = "inline-flex items-center justify-center rounded-[10px] border border-line px-[15.84px] py-[8.8px] text-sm leading-[1.2] font-semibold text-text pointer-coarse:min-h-11";

export function Pager({ page, total, pageSize, href }: { page: number; total: number; pageSize: number; href: (page: number) => string }) {
  const pages = Math.ceil(total / pageSize);
  if (pages <= 1) return null;
  const turn = (label: string, target: number) =>
    target >= 1 && target <= pages ? (
      <Link href={href(target)} className={`${button} hover:bg-text/7 active:bg-text/14`}>
        {label}
      </Link>
    ) : (
      <button type="button" disabled className={`${button} cursor-not-allowed opacity-45`}>
        {label}
      </button>
    );
  return (
    <nav aria-label="Phân trang" className="flex items-center gap-2.5">
      <span className="flex-1 text-[12.5px] text-text-3 tabular-nums">
        {(page - 1) * pageSize + 1}–{Math.min(total, page * pageSize)} trên {total}
      </span>
      {turn("Trước", page - 1)}
      <span className="min-w-[46px] text-center text-[13px] tabular-nums">
        {page} / {pages}
      </span>
      {turn("Sau", page + 1)}
    </nav>
  );
}
