"use client";

import { Download } from "lucide-react";
import { useState } from "react";
import { Button } from "./Button";

// Tải file qua fetch thay vì link: máy chủ từ chối (quá số dòng, hết phiên) thì báo ngay cạnh nút, không mở trang JSON.
export function ExportButton({ href }: { href: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function download() {
    setPending(true);
    setError("");
    try {
      const res = await fetch(href);
      if (!res.ok) return setError((await res.json().catch(() => null))?.message ?? "Không xuất được file. Thử lại sau ít phút.");
      const name = /filename="([^"]+)"/.exec(res.headers.get("content-disposition") ?? "")?.[1] ?? "danh-sach.xlsx";
      const url = URL.createObjectURL(await res.blob());
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.");
    } finally {
      setPending(false);
    }
  }

  // Màn hẹp: nút xuống hàng thứ hai, neo lời báo vào nút thì tràn mép trái; neo vào thanh tiêu đề để rộng hết màn hình.
  return (
    <span className="relative narrow:static">
      <Button variant="secondary" disabled={pending} onClick={download}>
        <Download size={16} aria-hidden />
        {pending ? "Đang xuất" : "Xuất Excel"}
      </Button>
      {error && (
        <span role="alert" className="absolute top-full right-0 z-10 mt-1 w-72 rounded-lg border border-danger bg-card px-3 py-2 text-[13px] text-danger shadow narrow:right-4 narrow:left-4 narrow:w-auto">
          {error}
        </span>
      )}
    </span>
  );
}
