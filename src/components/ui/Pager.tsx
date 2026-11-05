import Link from "next/link";

export function Pager({ page, total, pageSize, href }: { page: number; total: number; pageSize: number; href: (page: number) => string }) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const from = total ? (page - 1) * pageSize + 1 : 0;
  const to = Math.min(total, page * pageSize);
  const btn = "rounded-lg border border-line px-3 py-1.5 hover:bg-surface";
  return (
    <nav aria-label="Phân trang" className="flex items-center justify-between border-t border-line px-4 py-3 text-sm text-text-2">
      <span>
        {from}–{to} trên {total}
      </span>
      <span className="flex items-center gap-3">
        {page > 1 && (
          <Link href={href(page - 1)} className={btn}>
            Trước
          </Link>
        )}
        <span>
          {page} / {pages}
        </span>
        {page < pages && (
          <Link href={href(page + 1)} className={btn}>
            Sau
          </Link>
        )}
      </span>
    </nav>
  );
}
