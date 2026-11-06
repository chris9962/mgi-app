"use client";

import { clsx } from "clsx";
import { BriefcaseBusiness, Building2, ChevronDown, LogOut, Moon, Server, Settings, UserRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { BRAND_NAME } from "@/lib/brand";
import type { MenuGroup } from "./menu";

const GROUP_ICON: Record<string, React.ReactNode> = { work: <BriefcaseBusiness size={18} aria-hidden />, data: <Settings size={18} aria-hidden />, manage: <Building2 size={18} aria-hidden />, system: <Server size={18} aria-hidden /> };

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    .map((w) => w[0]?.toUpperCase())
    .join("");

type Props = { groups: MenuGroup[]; fullName: string; title: string; mobileOpen?: boolean; onMobileClose?: () => void };

export function Sidebar({ groups, fullName, title, mobileOpen = false, onMobileClose }: Props) {
  // Proxy rewrite sang /admin; bỏ tiền tố này nếu có để so với đường dẫn công khai.
  const pathname = (usePathname() ?? "/").replace(/^\/admin(?=\/|$)/, "") || "/";
  const router = useRouter();
  const [closed, setClosed] = useState<string[]>([]);
  const [menuOpen, setMenuOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);

  // Nghe phím Esc và bấm ra ngoài trên document khi menu mở; bỏ nghe khi menu đóng.
  // Esc nghe ở pha capture và preventDefault: menu nằm trong ngăn trượt thì Esc đầu chỉ đóng menu, ngăn bỏ qua.
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.preventDefault();
      setMenuOpen(false);
      trigger.current?.focus();
    };
    const onPointer = (e: PointerEvent) => {
      const target = e.target as Node;
      if (!panel.current?.contains(target) && !trigger.current?.contains(target)) setMenuOpen(false);
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("pointerdown", onPointer);
    };
  }, [menuOpen]);

  // Ngăn trượt mở thì focus vào ngăn và nghe Esc; khoá cuộn trang nằm ở globals.css, chỉ áp dưới 900 px.
  useEffect(() => {
    if (!mobileOpen) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onMobileClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileClose]);

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
    <>
      {mobileOpen && <div aria-hidden className="fixed inset-0 z-40 hidden bg-black/40 mobile:block" onClick={onMobileClose} />}
      <nav
        id="main-nav"
        data-open={mobileOpen || undefined}
        aria-label="Điều hướng chính"
        className={clsx(
          "flex w-[248px] flex-none flex-col border-r border-line bg-sidebar text-sidebar-ink",
          // Ngăn đóng thì ẩn hẳn sau khi trượt xong, để phím Tab không vào các link nằm ngoài màn hình.
          "mobile:fixed mobile:top-0 mobile:left-0 mobile:z-50 mobile:h-[100svh] mobile:w-[min(280px,85vw)] mobile:overflow-y-auto mobile:shadow-xl mobile:duration-200 mobile:motion-reduce:transition-none",
          mobileOpen ? "mobile:visible mobile:translate-x-0 mobile:transition-[translate]" : "mobile:invisible mobile:-translate-x-full mobile:transition-[translate,visibility]",
        )}
      >
        <div className="flex items-center gap-2.5 px-5 py-5 mobile:py-3 mobile:pr-3">
          <Logo size={30} />
          <span className="text-base leading-tight font-semibold">{BRAND_NAME}</span>
          <button
            type="button"
            ref={closeButton}
            onClick={onMobileClose}
            aria-label="Đóng menu điều hướng"
            className="ml-auto hidden size-11 flex-none place-items-center rounded-[10px] hover:bg-sidebar-hover mobile:grid"
          >
            <X size={20} aria-hidden />
          </button>
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
                      const active = pathname === item.href || (!item.exact && pathname.startsWith(item.href + "/"));
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={onMobileClose}
                            aria-current={active ? "page" : undefined}
                            className={clsx(
                              "flex h-10 items-center rounded-[10px] pl-[42px] text-sm",
                              active ? "bg-sidebar-active font-semibold text-on-accent" : "hover:bg-sidebar-hover",
                            )}
                          >
                            {item.label}
                            {item.badge !== undefined && (
                              <span className={clsx("mr-3 ml-auto min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-semibold", active ? "bg-card text-accent-ink" : "bg-danger-soft text-danger-ink")}>
                                {item.badge}
                                <span className="sr-only"> tin lỗi</span>
                              </span>
                            )}
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
            <div ref={panel} id="account-menu" className="absolute right-3 bottom-[72px] left-3 flex flex-col rounded-xl border border-line bg-card p-1.5 shadow-lg">
              <Link
                href="/profile"
                onClick={() => {
                  setMenuOpen(false);
                  onMobileClose?.();
                }}
                className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm hover:bg-surface"
              >
                <UserRound size={16} aria-hidden />
                Thông tin cá nhân
              </Link>
              <button type="button" onClick={toggleTheme} className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm hover:bg-surface">
                <Moon size={16} aria-hidden />
                Đổi giao diện sáng, tối
              </button>
              <hr className="my-1 border-line" />
              <button type="button" onClick={logout} className="flex h-10 items-center gap-2.5 rounded-lg px-3 text-sm text-danger hover:bg-danger-soft">
                <LogOut size={16} aria-hidden />
                Đăng xuất
              </button>
            </div>
          )}
          <button
            type="button"
            ref={trigger}
            aria-expanded={menuOpen}
            aria-controls="account-menu"
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
    </>
  );
}
