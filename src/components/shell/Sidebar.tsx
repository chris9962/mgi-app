"use client";

import { clsx } from "clsx";
import { Activity, BriefcaseBusiness, Building2, ChevronDown, GraduationCap, Landmark, MessageSquareWarning, Palette, QrCode, School, Server, Settings, SlidersHorizontal, Ticket, Users, WalletCards, X, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/ui/Logo";
import { BRAND_NAME } from "@/lib/brand";
import { AppearanceDialog } from "./AppearanceDialog";
import type { MenuGroup, MenuItem } from "./menu";

const GROUP_ICON: Record<string, LucideIcon | undefined> = { work: BriefcaseBusiness, data: Settings, manage: Building2, system: Server };

const ITEM_ICON: Record<string, LucideIcon | undefined> = {
  "/customers": GraduationCap,
  "/customer-banks": WalletCards,
  "/schools": School,
  "/banks": Landmark,
  "/banks/codes": QrCode,
  "/vouchers": Ticket,
  "/users": Users,
  "/sms": MessageSquareWarning,
  "/settings": SlidersHorizontal,
  "/ops": Activity,
};

// Số đo mục menu tài khoản chép .item của AccountMenu.module.css bên mgst-app.
const ACCOUNT_ITEM = "flex w-full items-center justify-between gap-3 rounded-md px-3 py-[9px] text-left text-[13.5px] leading-[1.55] hover:bg-text/7 focus-visible:-outline-offset-2";

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(-2)
    // Array.from tách theo ký tự thật: w[0] của emoji chỉ là nửa cặp surrogate, hiện thành ô hỏng.
    .map((w) => Array.from(w)[0]?.toUpperCase())
    .join("");

const isActive = (pathname: string, item: MenuItem) => pathname === item.href || (!item.exact && pathname.startsWith(item.href + "/"));

type Props = { groups: MenuGroup[]; fullName: string; title: string; mobileOpen?: boolean; onMobileClose?: () => void };

export function Sidebar({ groups, fullName, title, mobileOpen = false, onMobileClose }: Props) {
  // Proxy rewrite sang /admin; bỏ tiền tố này nếu có để so với đường dẫn công khai.
  const pathname = (usePathname() ?? "/").replace(/^\/admin(?=\/|$)/, "") || "/";
  const router = useRouter();
  // Như mgst-app: lúc mở trang chỉ nhóm chứa trang đang xem mở sẵn, nhóm khác người dùng tự mở.
  const [closed, setClosed] = useState<string[]>(() => groups.filter((g) => !g.items.some((i) => isActive(pathname, i))).map((g) => g.key));
  const [menuOpen, setMenuOpen] = useState(false);
  const [appearanceOpen, setAppearanceOpen] = useState(false);
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

  // Khoá cuộn trang không đặt ở đây mà ở globals.css theo khổ màn: xoay qua 900 px là tự hết khoá.
  useEffect(() => {
    if (!mobileOpen) return;
    closeButton.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !e.defaultPrevented) onMobileClose?.();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mobileOpen, onMobileClose]);

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <>
      {mobileOpen && <div aria-hidden className="fixed inset-0 z-40 hidden bg-(--backdrop) mobile:block" onClick={onMobileClose} />}
      <nav
        id="main-nav"
        data-open={mobileOpen || undefined}
        aria-label="Điều hướng chính"
        className={clsx(
          "flex h-full w-[236px] flex-none flex-col gap-[5px] overflow-y-auto border-r border-line bg-sidebar px-3.5 py-[22px] text-sidebar-ink",
          // Ngăn đóng thì ẩn hẳn sau khi trượt xong, để phím Tab không vào các link nằm ngoài màn hình.
          "mobile:fixed mobile:top-0 mobile:left-0 mobile:z-50 mobile:h-[100svh] mobile:w-[min(280px,85vw)] mobile:shadow-(--elev-lg) mobile:duration-200 mobile:motion-reduce:transition-none",
          mobileOpen ? "mobile:visible mobile:translate-x-0 mobile:transition-[translate]" : "mobile:invisible mobile:-translate-x-full mobile:transition-[translate,visibility]",
        )}
      >
        <div className="flex items-center gap-2.5 px-1.5 pb-4">
          <Logo size={32} />
          <strong className="min-w-0 text-[15px] leading-[1.15] font-bold">{BRAND_NAME}</strong>
          <button
            type="button"
            ref={closeButton}
            onClick={onMobileClose}
            aria-label="Đóng menu điều hướng"
            className="ml-auto hidden size-11 flex-none place-items-center rounded-[10px] hover:bg-sidebar-hover focus-visible:-outline-offset-2 mobile:grid"
          >
            <X size={20} aria-hidden />
          </button>
        </div>
        <ul className="flex flex-col gap-[5px]">
          {groups.map((g) => {
            const open = !closed.includes(g.key);
            const GroupIcon = GROUP_ICON[g.key];
            return (
              <li key={g.key}>
                <button
                  type="button"
                  aria-expanded={open}
                  onClick={() => setClosed((c) => (open ? [...c, g.key] : c.filter((k) => k !== g.key)))}
                  className="flex w-full items-center gap-[11px] rounded-[10px] px-[13px] py-[11px] text-left text-[13.5px] leading-[1.55] font-semibold hover:bg-sidebar-hover focus-visible:-outline-offset-2"
                >
                  {GroupIcon && <GroupIcon size={18} strokeWidth={1.8} aria-hidden className="flex-none opacity-[0.72]" />}
                  {g.label}
                  <ChevronDown size={15} aria-hidden className={clsx("ml-auto flex-none opacity-60 transition-transform duration-150", open && "rotate-180")} />
                </button>
                {open && (
                  <ul className="mt-0.5 flex flex-col gap-0.5">
                    {g.items.map((item) => {
                      const active = isActive(pathname, item);
                      const Icon = ITEM_ICON[item.href];
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            onClick={onMobileClose}
                            aria-current={active ? "page" : undefined}
                            className={clsx(
                              // Như mgst-app: icon mục con thụt vào so với icon nhóm; icon 16 px + khoảng 10 px nên chữ bắt đầu ở 52 px dù có icon hay không.
                              "flex items-center gap-2.5 rounded-[10px] py-[9px] pr-[13px] text-[13px] leading-[1.55] focus-visible:-outline-offset-2",
                              Icon ? "pl-[26px]" : "pl-[52px]",
                              active ? "bg-sidebar-active font-bold text-on-accent" : "hover:bg-sidebar-hover",
                            )}
                          >
                            {Icon && <Icon size={16} strokeWidth={1.8} aria-hidden className={clsx("flex-none", !active && "opacity-[0.72]")} />}
                            {item.label}
                            {item.badge !== undefined && (
                              <span className={clsx("ml-auto min-w-5 rounded-full px-1.5 text-center text-xs leading-5 font-semibold", active ? "bg-card text-accent-ink" : "bg-danger-soft text-danger-ink")}>
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
        <div className="mt-auto border-t border-line pt-3">
          <div className="relative">
            {menuOpen && (
              <div ref={panel} id="account-menu" className="absolute bottom-full left-0 z-[55] mb-2 flex min-w-[200px] flex-col rounded-[10px] border border-line bg-bg p-[5px] text-text shadow-(--elev-lg)">
                <Link
                  href="/profile"
                  onClick={() => {
                    setMenuOpen(false);
                    onMobileClose?.();
                  }}
                  className={ACCOUNT_ITEM}
                >
                  Thông tin cá nhân
                </Link>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    setAppearanceOpen(true);
                  }}
                  className={ACCOUNT_ITEM}
                >
                  Giao diện
                  <Palette size={15} aria-hidden className="text-text-3" />
                </button>
                <hr className="mx-2 my-1 border-line" />
                <button type="button" onClick={logout} className={clsx(ACCOUNT_ITEM, "text-accent-ink")}>
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
              className="flex w-full items-center gap-2.5 rounded-full px-2.5 py-[9px] text-left hover:bg-sidebar-hover focus-visible:-outline-offset-2"
            >
              <span className="grid size-[30px] flex-none place-items-center rounded-full bg-accent-soft text-[11.5px] font-bold text-accent-ink">{initials(fullName)}</span>
              <span className="flex min-w-0 flex-col leading-[1.2]">
                <b className="truncate text-[12.5px] font-semibold">{fullName}</b>
                <span className="truncate text-[10.5px] text-sidebar-ink-2">{title}</span>
              </span>
            </button>
          </div>
        </div>
      </nav>
      {/* Ngoài nav: ngăn trượt đóng thì nav ẩn (invisible), hộp thoại nằm trong sẽ ẩn theo. */}
      {appearanceOpen && (
        <AppearanceDialog
          onClose={() => {
            setAppearanceOpen(false);
            trigger.current?.focus();
          }}
        />
      )}
    </>
  );
}
