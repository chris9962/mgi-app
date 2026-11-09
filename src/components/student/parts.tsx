import { clsx } from "clsx";
import { Landmark } from "lucide-react";
import type { ReactNode } from "react";
import { QrPreview } from "@/components/settings/QrPreview";

export function BankLogo({ src }: { src: string | null }) {
  if (!src)
    return (
      <span aria-hidden className="grid aspect-[8/3] w-full place-items-center rounded-lg bg-surface text-text-3">
        <Landmark size={26} />
      </span>
    );
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="aspect-[8/3] w-full rounded-lg object-contain ring-1 ring-line" />;
}

export function AppHead({ school, title }: { school: string; title: string }) {
  return (
    <div className="flex flex-col gap-0.5 py-2">
      <span className="text-[13px] text-text-2">{school}</span>
      <h1 className="text-xl font-semibold">{title}</h1>
    </div>
  );
}

const STEP_LABEL = ["Thông tin", "Chọn ngân hàng", "Mở tài khoản"];

export function Steps({ current }: { current: 1 | 2 | 3 }) {
  return (
    <ol aria-label="Các bước" className="my-2 flex items-center gap-2">
      {STEP_LABEL.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "on" : "todo";
        return (
          <li key={label} aria-current={state === "on" ? "step" : undefined} className="flex flex-1 items-center gap-2 last:flex-none">
            <span
              className={clsx(
                "grid size-7 flex-none place-items-center rounded-full border text-[13px] font-semibold",
                state === "on" && "border-accent bg-accent text-on-accent",
                state === "done" && "border-ok bg-ok-soft text-ok-ink",
                state === "todo" && "border-field-border text-text-2",
              )}
            >
              {state === "done" ? <span aria-hidden>✓</span> : n}
              <span className="sr-only">
                {label}
                {state === "done" ? ", đã xong" : ""}
              </span>
            </span>
            {n < 3 && <span aria-hidden className={clsx("h-0.5 flex-1 rounded", n < current ? "bg-ok" : "bg-line")} />}
          </li>
        );
      })}
    </ol>
  );
}

// Màn chỉ có khối này (H0, lỗi tải) thì tiêu đề là h1; màn có AppHead thì là h2.
export function EndBlock({ title, hint, mark, main }: { title: string; hint?: string; mark?: boolean; main?: boolean }) {
  const Heading = main ? "h1" : "h2";
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
      {mark && (
        <span aria-hidden className="grid size-12 place-items-center rounded-full bg-accent-soft text-xl font-bold text-accent-ink">
          !
        </span>
      )}
      <Heading className="text-lg font-semibold">{title}</Heading>
      {hint && <p className="text-sm text-text-2">{hint}</p>}
    </div>
  );
}

export function ZaloBox({ url, text }: { url: string; text: string }) {
  if (!url) return null;
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 hover:bg-surface">
      <QrPreview value={url} label="QR kết bạn Zalo" size={56} />
      <span className="text-sm text-text-2">{text}</span>
    </a>
  );
}

export function Bottom({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-2 pt-6">{children}</div>;
}
