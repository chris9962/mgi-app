import { clsx } from "clsx";
import Link from "next/link";

export function BankTabs({ current }: { current: "banks" | "codes" }) {
  const tab = (href: string, label: string, on: boolean) => (
    <Link
      href={href}
      aria-current={on ? "page" : undefined}
      className={clsx("border-b-2 px-1 pb-2.5 text-sm font-semibold", on ? "border-accent text-accent-ink" : "border-transparent text-text-2 hover:text-text")}
    >
      {label}
    </Link>
  );
  return (
    <nav aria-label="Ngân hàng và mã giới thiệu" className="mb-4 flex gap-6 border-b border-line">
      {tab("/banks", "Danh sách ngân hàng", current === "banks")}
      {tab("/banks/codes", "Kho mã giới thiệu", current === "codes")}
    </nav>
  );
}
