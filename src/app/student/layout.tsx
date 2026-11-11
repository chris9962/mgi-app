
export const metadata = { title: "Mở tài khoản" };

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    // Tên trường, ngân hàng, học sinh không có trần độ dài: chuỗi liền không dấu cách phải xuống dòng, không đẩy trang cuộn ngang.
    // overflow-x-clip: màn mới trượt ngang vào không làm trang cuộn ngang; clip không tạo khung cuộn nên thanh tab sticky vẫn dính.
    <div data-student className="relative isolate overflow-x-clip">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-28 bg-gradient-to-b from-accent-soft/60 to-transparent" />
      <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col px-4 pb-6 wrap-anywhere">
        <main className="flex flex-1 flex-col">{children}</main>
      </div>
    </div>
  );
}
