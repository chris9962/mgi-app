import { clsx } from "clsx";

export type Tone = "ok" | "neutral" | "danger" | "progress" | "warn";

const TONE: Record<Tone, string> = {
  ok: "border-ok bg-ok-soft text-ok-ink",
  neutral: "border-line text-text-3",
  danger: "border-danger bg-danger-soft text-danger-ink",
  progress: "border-accent-soft bg-accent-soft text-accent-ink",
  warn: "border-warn text-warn-ink",
};

export function StatusTag({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return (
    <span className={clsx("inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold", TONE[tone])}>
      {tone === "ok" && <span aria-hidden className="mr-1">✓</span>}
      {tone === "warn" && <span aria-hidden className="mr-1">!</span>}
      {children}
    </span>
  );
}
