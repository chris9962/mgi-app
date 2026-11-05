"use client";

import QRCode from "qrcode";
import { useEffect, useState } from "react";

// Vẽ ảnh QR từ link ngay trên trình duyệt, đổi link thì vẽ lại.
export function QrPreview({ value, label }: { value: string; label: string }) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let stale = false;
    if (!/^https?:\/\/\S+$/i.test(value)) return;
    QRCode.toDataURL(value, { width: 168, margin: 1 }).then((url) => !stale && setSrc(url));
    return () => {
      stale = true;
    };
  }, [value]);
  const valid = /^https?:\/\/\S+$/i.test(value);
  return valid && src ? (
    <img src={src} alt={label} width={84} height={84} className="flex-none rounded-md border border-line bg-white" />
  ) : (
    <span className="grid size-[84px] flex-none place-items-center rounded-md border border-dashed border-line text-center text-xs text-text-3">Chưa có link</span>
  );
}
