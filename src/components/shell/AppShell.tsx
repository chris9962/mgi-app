"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";
import { BottomNav } from "./BottomNav";
import { bottomNavItems } from "./bottomNavItems";
import type { MenuGroup } from "./menu";
import { Sidebar } from "./Sidebar";

export function AppShell({ groups, fullName, title, children }: { groups: MenuGroup[]; fullName: string; title: string; children: ReactNode }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const more = useRef<HTMLButtonElement>(null);

  // Giữ nguyên hàm qua các lần render: effect của Sidebar phụ thuộc hàm này, chạy lại là focus nhảy về nút Đóng.
  const closeMenu = useCallback(() => {
    setMenuOpen(false);
    more.current?.focus();
  }, []);

  // svh chứ không dvh: dvh đổi theo thanh địa chỉ lúc cuộn, khung co giãn lệch nhịp với thanh đáy cố định.
  return (
    <div className="flex min-h-dvh mobile:min-h-[100svh] mobile:flex-col">
      <Sidebar groups={groups} fullName={fullName} title={title} mobileOpen={menuOpen} onMobileClose={closeMenu} />
      <div className="flex min-w-0 flex-1 flex-col mobile:pb-[calc(52px+env(safe-area-inset-bottom,0px))]">{children}</div>
      <BottomNav items={bottomNavItems(groups)} menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} moreRef={more} />
    </div>
  );
}
