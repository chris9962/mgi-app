"use client";

import { Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export function PasswordDialog({ open, name, password, onClose }: { open: boolean; name: string; password: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  return (
    <Dialog open={open} title="Mật khẩu mới" onClose={onClose} width={420} footer={<Button onClick={onClose}>Đóng</Button>}>
      <p className="text-sm text-text-2">Mật khẩu mới của {name} là:</p>
      <div className="flex items-center gap-3">
        <code className="flex-1 rounded-[10px] border border-line bg-surface px-3.5 py-2 text-lg tracking-wider">{password}</code>
        <Button
          variant="secondary"
          onClick={async () => {
            await navigator.clipboard.writeText(password);
            setCopied(true);
          }}
        >
          <Copy size={16} aria-hidden />
          {copied ? "Đã chép" : "Chép"}
        </Button>
      </div>
    </Dialog>
  );
}
