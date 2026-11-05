import { clsx } from "clsx";
import type { ReactNode } from "react";

export const inputClass =
  "block w-full min-h-9 rounded-[10px] border border-line bg-card px-3.5 py-[7px] text-sm leading-5 text-text placeholder:text-text-3 aria-[invalid=true]:border-danger";

export function Field({ id, label, error, hint, children }: { id: string; label: string; error?: string; hint?: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-text-2">
        {label}
      </label>
      {children}
      {error ? (
        <span id={`${id}-error`} className="text-[13px] text-danger">
          {error}
        </span>
      ) : hint ? (
        <span className={clsx("text-[13px] text-text-3")}>{hint}</span>
      ) : null}
    </div>
  );
}
