import type { ReactNode } from "react";

// Số đo chép TopBar.module.scss của mgst-app. Riêng tiêu đề vẫn cho xuống dòng ở máy tính: tên học sinh 100 ký tự liền không được đẩy trang cuộn ngang.
export function TopBar({ title, actions }: { title: string; actions?: ReactNode }) {
  // sticky cũng là gốc neo: ở màn hẹp bảng Bộ lọc và lời báo lỗi xuất Excel neo vào thanh tiêu đề để rộng hết màn hình, không neo vào nút.
  return (
    <header className="sticky top-0 z-[5] flex min-h-[66px] flex-none flex-wrap items-center gap-3 border-b border-line bg-bg px-7 py-2.5 mobile:px-4">
      <h1 className="min-w-0 text-[20px] leading-[1.12] font-semibold tracking-[-0.015em] wrap-anywhere mobile:truncate">{title}</h1>
      {/* Phần tử cuối là hành động chính của trang: cách thêm 6 px để tách khỏi nhóm tìm, lọc. Bỏ qua thẻ dialog: hộp thoại của nút nằm cuối khối này, dính margin trái 6 px thì mất m-auto và lệch sang trái. Ô tìm chiếm trọn một hàng ở điện thoại (basis-full), nút hành động xuống hàng dưới. */}
      {actions && (
        <div className="flex min-w-0 flex-auto flex-wrap items-center justify-end gap-2.5 *:flex-none [&>:nth-last-child(1_of_:not(dialog))]:ml-1.5 mobile:[&>[role=search]]:basis-full">
          {actions}
        </div>
      )}
    </header>
  );
}
