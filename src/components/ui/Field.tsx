import type { ReactNode } from "react";

// Số đo chép .input của mgst-app. Viền đọc --field-border: trang quản lý đặt token này bằng --line, web học sinh giữ màu đậm đạt 3:1.
export const inputClass =
  "block w-full min-h-9 rounded-[10px] border border-field-border bg-card px-3.5 py-1.5 text-sm leading-[1.55] text-text caret-accent placeholder:text-text-3 focus-visible:border-accent focus-visible:outline-offset-0 disabled:cursor-not-allowed disabled:opacity-55 aria-[invalid=true]:border-danger [&:hover:not(:disabled):not([aria-invalid=true])]:border-text/45";

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-text-2">
        {label}
      </label>
      {children}
      {error ? (
        <span id={`${id}-error`} className="text-[12.5px] text-danger">
          {error}
        </span>
      ) : hint ? (
        <span className="text-xs text-text-3">{hint}</span>
      ) : null}
    </div>
  );
}
