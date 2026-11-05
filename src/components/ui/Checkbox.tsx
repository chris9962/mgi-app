import type { InputHTMLAttributes } from "react";

export function Checkbox({ label, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  return (
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-2.5 text-sm">
      <input type="checkbox" className="size-[18px] accent-[var(--accent)]" {...rest} />
      {label}
    </label>
  );
}
