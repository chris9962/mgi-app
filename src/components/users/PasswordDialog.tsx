"use client";

import { Copy } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export function PasswordDialog({ open, name, password, onClose }: { open: boolean; name: string; password: string; onClose: () => void }) {
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");
  const code = useRef<HTMLElement>(null);

  // Trang chạy http thì trình duyệt không có navigator.clipboard: báo không chép được và chọn sẵn mật khẩu để chép tay.
  const copyPassword = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopy("done");
    } catch {
      setCopy("failed");
      if (code.current) window.getSelection()?.selectAllChildren(code.current);
    }
  };

  return (
    <Dialog open={open} title="Mật khẩu mới" onClose={onClose} footer={<Button onClick={onClose}>Đóng</Button>}>
      <p className="text-sm text-text-2">Mật khẩu mới của {name} là:</p>
      <div className="flex items-center gap-3">
        <code ref={code} className="flex-1 rounded-[10px] border border-line bg-surface px-3.5 py-2 text-lg tracking-wider">
          {password}
        </code>
        <Button variant="secondary" onClick={copyPassword}>
          <Copy size={16} aria-hidden />
          {copy === "done" ? "Đã chép" : "Chép"}
        </Button>
      </div>
      <p role="status" className="text-sm text-danger-ink">
        {copy === "failed" ? "Không chép được." : ""}
      </p>
    </Dialog>
  );
}
