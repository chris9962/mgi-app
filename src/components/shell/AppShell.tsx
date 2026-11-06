"use client";

import { usePathname } from "next/navigation";
import { useCallback, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { BottomNav } from "./BottomNav";
import { bottomNavItems } from "./bottomNavItems";
import type { MenuGroup } from "./menu";
import { Sidebar } from "./Sidebar";

export function AppShell({ groups, fullName, title, children }: { groups: MenuGroup[]; fullName: string; title: string; children: ReactNode }) {
  const pathname = usePathname();
  // Ngăn chỉ mở trên trang lúc bấm Thêm: chuyển trang kiểu nào (cả nút Quay lại) cũng đóng, không cần effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const menuOpen = openedAt !== null && openedAt === pathname;
  const more = useRef<HTMLButtonElement>(null);

  // Giữ nguyên hàm qua các lần render: effect của Sidebar phụ thuộc hàm này, chạy lại là focus nhảy về nút Đóng.
  // flushSync: thanh đáy còn inert tới khi React vẽ lại, focus trước đó thì trình duyệt bỏ qua.
  const closeMenu = useCallback(() => {
    flushSync(() => setOpenedAt(null));
    more.current?.focus();
  }, []);

  // svh chứ không dvh: dvh đổi theo thanh địa chỉ lúc cuộn, khung co giãn lệch nhịp với thanh đáy cố định.
  // Lề nội dung 16 px như mgst-app và như thanh tiêu đề, đặt một chỗ thay cho p-6 của từng trang.
  // Ngăn mở thì nội dung và thanh đáy inert: Tab không rơi vào chỗ bị ngăn che, trình đọc màn hình chỉ đọc ngăn.
  return (
    <div className="flex min-h-dvh mobile:min-h-[100svh] mobile:flex-col">
      <Sidebar groups={groups} fullName={fullName} title={title} mobileOpen={menuOpen} onMobileClose={closeMenu} />
      <div className="flex min-w-0 flex-1 flex-col mobile:pb-[calc(52px+env(safe-area-inset-bottom,0px))] mobile:[&>main]:p-4" inert={menuOpen}>
        {children}
      </div>
      <BottomNav items={bottomNavItems(groups)} menuOpen={menuOpen} onOpenMenu={() => setOpenedAt(pathname)} moreRef={more} />
    </div>
  );
}
