import { clsx } from "clsx";
import { Check, Minus, RefreshCw, TriangleAlert, X } from "lucide-react";

export type Tone = "ok" | "neutral" | "danger" | "progress" | "warn";

const TONE: Record<Tone, string> = {
  ok: "border-ok bg-ok-soft text-ok-ink",
  neutral: "border-line text-text-3",
  danger: "border-danger bg-danger-soft text-danger-ink",
  progress: "border-accent-light bg-accent-soft text-accent-ink",
  warn: "border-warn text-warn-ink",
};

const MARK: Record<Tone, React.ReactNode> = {
  ok: <Check size={13} strokeWidth={3} />,
  neutral: <Minus size={13} strokeWidth={3} />,
  danger: <X size={13} strokeWidth={3} />,
  progress: <RefreshCw size={12} strokeWidth={2.5} />,
  warn: <TriangleAlert size={12} />,
};

// Web học sinh đọc trên điện thoại nên giữ cỡ md; trang quản lý dùng cỡ sm của mgst-app.
export function StatusTag({ tone, size = "sm", children }: { tone: Tone; size?: "sm" | "md"; children: React.ReactNode }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center whitespace-nowrap rounded-full border",
        size === "sm" ? "px-2.5 py-[3px] text-[11px] leading-[1.55] tracking-[0.02em]" : "px-2.5 py-0.5 text-xs font-semibold",
        TONE[tone],
      )}
    >
      <span aria-hidden className="mr-[5px] inline-grid place-items-center leading-none">
        {MARK[tone]}
      </span>
      {children}
    </span>
  );
}
