"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { flushSync } from "react-dom";
import { MOBILE_QUERY } from "@/lib/breakpoints";
import { BottomNav } from "./BottomNav";
import { bottomNavItems } from "./bottomNavItems";
import type { MenuGroup } from "./menu";
import { Sidebar } from "./Sidebar";

export function AppShell({ groups, fullName, title, children }: { groups: MenuGroup[]; fullName: string; title: string; children: ReactNode }) {
  // So cả chuỗi lọc: Quay lại từ ?status=new về trang không lọc cũng là chuyển trang.
  const location = `${usePathname()}?${useSearchParams()}`;
  // Ngăn chỉ mở trên trang lúc bấm Thêm: chuyển trang kiểu nào (cả nút Quay lại) cũng đóng, không cần effect.
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  // Bỏ hẳn trạng thái ngay lúc render khi đã sang trang khác: khung không mount lại, giữ đường dẫn cũ thì về lại trang đó ngăn tự mở.
  if (openedAt !== null && openedAt !== location) setOpenedAt(null);
  const menuOpen = openedAt === location;
  const more = useRef<HTMLButtonElement>(null);

  // Màn rộng qua 900 px thì sidebar thành cột cố định: bỏ trạng thái ngăn, không thì nội dung còn inert và Esc còn đòi focus nút Thêm đã ẩn.
  useEffect(() => {
    const query = matchMedia(MOBILE_QUERY);
    const onChange = () => {
      if (!query.matches) setOpenedAt(null);
    };
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  // Giữ nguyên hàm qua các lần render: effect của Sidebar phụ thuộc hàm này, chạy lại là focus nhảy về nút Đóng.
  // flushSync: thanh đáy còn inert tới khi React vẽ lại, focus trước đó thì trình duyệt bỏ qua.
  const closeMenu = useCallback(() => {
    flushSync(() => setOpenedAt(null));
    more.current?.focus();
  }, []);

  // svh chứ không dvh: dvh đổi theo thanh địa chỉ lúc cuộn, khung co giãn lệch nhịp với thanh đáy cố định.
  // Lề nội dung chép .body của mgst-app (22, 28, 40 px; điện thoại 16, 16, 32 px), đặt một chỗ và thắng p-6 của từng trang.
  // Ngăn mở thì nội dung và thanh đáy inert: Tab không rơi vào chỗ bị ngăn che, trình đọc màn hình chỉ đọc ngăn.
  return (
    // Chép khung của mgst-app: ở máy tính sidebar và vùng nội dung cuộn độc lập, thanh tiêu đề dính đầu vùng nội dung; điện thoại thì cả trang cuộn. Chữ nền 15 px, dòng 1,55 như body của mgst-app; web học sinh giữ 16 px. Viền ô nhập dùng --line như mgst-app (chủ dự án chốt 2026-11-12); web học sinh giữ viền đậm.
    <div className="flex h-dvh overflow-hidden [--field-border:var(--line)] text-[15px] leading-[1.55] mobile:h-auto mobile:min-h-[100svh] mobile:flex-col mobile:overflow-visible">
      <Sidebar groups={groups} fullName={fullName} title={title} mobileOpen={menuOpen} onMobileClose={closeMenu} />
      {/* relative: phần tử absolute như sr-only neo vào vùng cuộn này, không neo vào tài liệu rồi kéo tài liệu dài ra. */}
      <div
        className="relative flex min-w-0 flex-1 flex-col overflow-y-auto min-[900.02px]:has-[dialog[open]]:overflow-hidden mobile:overflow-visible mobile:pb-[calc(var(--bottom-nav-h)+env(safe-area-inset-bottom,0px))] [&>main]:px-7 [&>main]:pt-[22px] [&>main]:pb-10 mobile:[&>main]:px-4 mobile:[&>main]:pt-4 mobile:[&>main]:pb-8"
        inert={menuOpen}
      >
        {children}
      </div>
      <BottomNav items={bottomNavItems(groups)} menuOpen={menuOpen} onOpenMenu={() => setOpenedAt(location)} moreRef={more} />
    </div>
  );
}
