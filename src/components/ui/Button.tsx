import { clsx } from "clsx";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover border-transparent",
  secondary: "bg-card text-text border-line hover:bg-surface",
  ghost: "bg-transparent text-text border-transparent hover:bg-surface",
  danger: "bg-card text-danger border-danger hover:bg-danger-soft",
};

type Props = ComponentProps<"button"> & { variant?: Variant; large?: boolean; block?: boolean };

export function Button({ variant = "primary", large, block, className, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex items-center justify-center gap-2 rounded-[10px] border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60",
        large ? "h-11 px-5 text-[15px]" : "h-9 px-3.5 text-sm",
        block && "w-full",
        VARIANT[variant],
        className,
      )}
      {...rest}
    />
  );
}
