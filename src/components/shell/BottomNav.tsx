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

const itemClass = "relative flex min-h-[52px] flex-1 flex-col items-center justify-center gap-1 px-1 py-2 text-center text-[11px] font-semibold focus-visible:-outline-offset-2 [&_svg]:opacity-80";

// Chép BottomNav của mgst-app: chỉ hiện dưới 900 px, nút Thêm mở lại sidebar đầy đủ.
export function BottomNav({ items, menuOpen, onOpenMenu, moreRef }: { items: MenuItem[]; menuOpen: boolean; onOpenMenu: () => void; moreRef: Ref<HTMLButtonElement> }) {
  const pathname = (usePathname() ?? "/").replace(/^\/admin(?=\/|$)/, "") || "/";
  // transform-gpu ép lớp GPU riêng: không có thì WebKit vẽ sai chỗ phần tử fixed lúc thanh địa chỉ ẩn hiện.
  return (
    <nav aria-label="Điều hướng nhanh" className="fixed inset-x-0 bottom-0 z-30 hidden border-t border-line bg-sidebar pb-[env(safe-area-inset-bottom,0px)] text-sidebar-ink-2 transform-gpu will-change-transform mobile:flex">
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
            {item.label}
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
