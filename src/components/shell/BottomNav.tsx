"use client";

import { clsx } from "clsx";
import { Landmark, Menu, TicketCheck, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode, Ref } from "react";
import type { MenuItem } from "./menu";

const ICON: Record<string, ReactNode> = {
  "/customers": <Users size={18} aria-hidden />,
  "/customer-banks": <Landmark size={18} aria-hidden />,
  "/vouchers": <TicketCheck size={18} aria-hidden />,
};

const itemClass = "relative flex min-w-0 flex-auto flex-col items-center justify-center gap-1 px-0.5 text-center text-[11px] font-semibold focus-visible:-outline-offset-2 [&_svg]:opacity-80";

export function BottomNav({ items, menuOpen, onOpenMenu, moreRef }: { items: MenuItem[]; menuOpen: boolean; onOpenMenu: () => void; moreRef: Ref<HTMLButtonElement> }) {
  const pathname = (usePathname() ?? "/").replace(/^\/admin(?=\/|$)/, "") || "/";
  // transform-gpu ép lớp GPU riêng: không có thì WebKit vẽ sai chỗ phần tử fixed lúc thanh địa chỉ ẩn hiện.
  return (
    <nav aria-label="Điều hướng nhanh" inert={menuOpen} className="fixed inset-x-0 bottom-0 z-30 hidden h-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px))] border-t border-line bg-sidebar pb-[env(safe-area-inset-bottom,0px)] text-sidebar-ink-2 transform-gpu will-change-transform mobile:flex">
      {items.map((item) => {
        const active = pathname === item.href || (!item.exact && pathname.startsWith(item.href + "/"));
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              itemClass,
              // Vạch trên đầu là dấu hiệu thứ hai ngoài màu chữ.
              active && "text-accent-ink before:absolute before:top-0 before:left-1/2 before:h-[3px] before:w-7 before:-translate-x-1/2 before:rounded-b-[3px] before:bg-accent [&_svg]:opacity-100",
            )}
          >
            {ICON[item.href]}
            {/* Nhãn một hàng để thanh luôn cao đúng --bottom-nav-h; mục rộng theo nhãn nên 320 px vẫn đủ chỗ. */}
            <span className="max-w-full truncate">{item.label}</span>
          </Link>
        );
      })}
      <button type="button" ref={moreRef} aria-expanded={menuOpen} aria-controls="main-nav" onClick={onOpenMenu} className={itemClass}>
        <Menu size={18} aria-hidden />
        Thêm
      </button>
    </nav>
  );
}
