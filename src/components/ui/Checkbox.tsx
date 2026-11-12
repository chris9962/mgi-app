import { Check } from "lucide-react";
import type { InputHTMLAttributes } from "react";

export function Checkbox({ label, ...rest }: Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string }) {
  return (
    <label className="inline-flex min-h-9 cursor-pointer items-center gap-[9px] text-[13.5px]">
      <span className="relative grid size-5 flex-none place-items-center">
        <input type="checkbox" className="peer absolute inset-0 size-full cursor-pointer appearance-none rounded-md border-[1.5px] border-field-border bg-card checked:border-accent checked:bg-accent disabled:cursor-not-allowed disabled:opacity-45" {...rest} />
        <Check size={14} strokeWidth={3.2} aria-hidden className="pointer-events-none relative hidden text-on-accent peer-checked:block" />
      </span>
      {label}
    </label>
  );
}
