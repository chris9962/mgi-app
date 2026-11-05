"use client";

import { clsx } from "clsx";
import { Building2, ChevronDown, LogOut, Moon, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { BRAND_NAME } from "@/lib/brand";
import type { MenuGroup } from "./menu";

const GROUP_ICON: Record<string, React.ReactNode> = { manage: <Building2 size={18} aria-hidden /> };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

export function Sidebar({ groups, fullName, title }: { groups: MenuGroup[]; fullName: string; title: string }) {
  // Proxy rewrite sang /admin; bỏ tiền tố này nếu có để so với đường dẫn công khai.
  const pathname = (usePathname() ?? "/").replace(/^\/admin(?=\/|$)/, "") || "/";
  const router = useRouter();
  const [closed, setClosed] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);

  function toggleTheme() {
    const dark = document.documentElement.dataset.theme !== "dark";
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    localStorage.setItem("theme", dark ? "dark" : "light");
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <nav aria-label="Điều hướng chính" className="flex w-[248px] flex-none flex-col border-r border-line bg-sidebar text-sidebar-ink">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <Logo size={30} />
        <span className="text-base leading-tight font-semibold">{BRAND_NAME}</span>
      </div>
      <ul className="flex flex-1 flex-col gap-1 px-3">
        {groups.map((g) => {
          const open = !closed.includes(g.key);
          return (
            <li key={g.key}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setClosed((c) => (open ? [...c, g.key] : c.filter((k) => k !== g.key)))}
                className="flex h-10 w-full items-center gap-3 rounded-[10px] px-3 text-[15px] hover:bg-sidebar-hover"
              >
                {GROUP_ICON[g.key]}
                {g.label}
                <ChevronDown size={18} aria-hidden className={clsx("ml-auto transition-transform", !open && "-rotate-90")} />
              </button>
              {open && (
                <ul className="mt-1 flex flex-col gap-1">
                  {g.items.map((item) => {
                    const active = pathname === item.href || pathname.startsWith(item.href + "/");
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={clsx(
                            "flex h-10 items-center rounded-[10px] pl-[42px] text-sm",
                            active ? "bg-sidebar-active font-semibold text-on-accent" : "hover:bg-sidebar-hover",
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
      <div className="relative border-t border-line p-3">
        {menuOpen && (
          <div role="menu" aria-label="Tài khoản của tôi" className="absolute right-3 bottom-[72px] left-3 flex flex-col rounded-xl border border-line bg-card p-1.5 shadow-lg">
            <Link role="menuitem" href="/profile" onClick={() => setMenuOpen(false)} className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm hover:bg-surface">
              <UserRound size={16} aria-hidden />
              Thông tin cá nhân
            </Link>
            <button role="menuitem" type="button" onClick={toggleTheme} className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm hover:bg-surface">
              <Moon size={16} aria-hidden />
              Đổi giao diện sáng, tối
            </button>
            <hr className="my-1 border-line" />
            <button role="menuitem" type="button" onClick={logout} className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-danger hover:bg-danger-soft">
              <LogOut size={16} aria-hidden />
              Đăng xuất
            </button>
          </div>
        )}
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
          className="flex w-full items-center gap-3 rounded-[10px] p-2 text-left hover:bg-sidebar-hover"
        >
          <span className="grid size-9 flex-none place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-ink">{initials(fullName)}</span>
          <span className="flex min-w-0 flex-col">
            <b className="truncate text-sm font-semibold">{fullName}</b>
            <span className="truncate text-xs text-sidebar-ink-2">{title}</span>
          </span>
        </button>
      </div>
    </nav>
  );
}
