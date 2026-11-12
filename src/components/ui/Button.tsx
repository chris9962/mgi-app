import { clsx } from "clsx";
import type { ComponentProps } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<Variant, string> = {
  primary: "border-transparent bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-ink",
  secondary: "border-line bg-transparent text-text hover:bg-text/7 active:bg-text/14",
  ghost: "border-transparent bg-transparent text-accent hover:bg-accent/10 active:bg-accent/18",
  danger: "border-danger bg-transparent text-danger hover:bg-danger-soft",
};

type Props = ComponentProps<"button"> & { variant?: Variant; large?: boolean; block?: boolean };

// Số đo chép .btn của mgst-app: đệm 8,8 px và 15,84 px, chữ 14 px cao dòng 1,2; nút lớn đệm 14 px, cao tối thiểu 48 px.
export function Button({ variant = "primary", large, block, className, type = "button", ...rest }: Props) {
  return (
    <button
      type={type}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-[10px] border leading-[1.2] font-semibold disabled:cursor-not-allowed disabled:opacity-45 pointer-coarse:min-h-11 [&_svg]:block [&_svg]:flex-none",
        large ? "min-h-12 p-3.5 text-[15px]" : clsx("py-[8.8px] text-sm", variant === "ghost" ? "px-[4.4px]" : "px-[15.84px]"),
        block && "w-full",
        VARIANT[variant],
        className,
      )}
      {...rest}
    />
  );
}
