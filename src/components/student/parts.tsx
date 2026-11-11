import { clsx } from "clsx";
import { Check, Landmark, School } from "lucide-react";
import type { ReactNode } from "react";
import { QrPreview } from "@/components/settings/QrPreview";

export function BankLogo({ src }: { src: string | null }) {
  if (!src)
    return (
      <span aria-hidden className="grid aspect-[8/3] w-full place-items-center rounded-lg bg-surface text-text-3">
        <Landmark size={26} />
      </span>
    );
  // Logo tải lên hay có nền trong suốt: nền trắng như ảnh QR để chữ tối của logo đọc được ở giao diện tối.
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" className="aspect-[8/3] w-full rounded-lg bg-white object-contain ring-1 ring-line" />;
}

export function AppHead({ school, title }: { school: string; title: string }) {
  return (
    <div className="flex flex-col gap-1 py-2">
      <span className="flex items-start gap-1.5 text-[13px] text-text-2">
        <School size={15} aria-hidden className="mt-0.5 flex-none text-accent-ink" />
        {school}
      </span>
      <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
    </div>
  );
}

const STEP_LABEL = ["Thông tin", "Chọn ngân hàng", "Mở tài khoản"];

// onBack: màn cho bấm các bước đã xong để quay lại; pendingStep là bước đang chờ máy chủ trước khi chuyển màn.
export function Steps({ current, onBack, pendingStep }: { current: 1 | 2 | 3; onBack?: (step: 1 | 2) => void; pendingStep?: 1 | 2 | null }) {
  return (
    <ol aria-label="Các bước" className="mt-3 mb-5 grid grid-cols-3">
      {STEP_LABEL.map((label, i) => {
        const n = i + 1;
        const state = n < current ? "done" : n === current ? "on" : "todo";
        const pending = pendingStep === n;
        const mark = (
          <>
            <span
              className={clsx(
                "grid size-8 flex-none place-items-center rounded-full border text-[13px] font-semibold",
                state === "on" && "anim-pulse border-accent bg-accent text-on-accent",
                state === "done" && "border-ok bg-ok-soft text-ok-ink",
                state === "todo" && "border-field-border bg-card text-text-2",
              )}
            >
              {pending ? (
                <span aria-hidden className="size-4 animate-spin rounded-full border-2 border-ok/30 border-t-ok-ink" />
              ) : state === "done" ? (
                <Check size={16} strokeWidth={3} aria-hidden />
              ) : (
                n
              )}
            </span>
            <span className={clsx("px-1 text-xs leading-tight", state === "on" ? "font-semibold text-text" : "text-text-2")}>
              {label}
              {state === "done" && <span className="sr-only">, đã xong</span>}
            </span>
          </>
        );
        return (
          <li key={label} aria-current={state === "on" ? "step" : undefined} className="relative flex flex-col items-center gap-1.5 text-center">
            {n < 3 && (
              <span aria-hidden className="absolute top-4 left-[calc(50%+22px)] h-0.5 w-[calc(100%-44px)] -translate-y-1/2 overflow-hidden rounded bg-line">
                {/* Chỉ đoạn nối tới bước đang đứng mới chạy: đoạn đó vừa hoàn thành. */}
                {n < current && <span className={clsx("block size-full bg-ok", n === current - 1 && "anim-line")} />}
              </span>
            )}
            {onBack && state === "done" ? (
              <button type="button" disabled={pendingStep != null} onClick={() => onBack(n as 1 | 2)} className="flex cursor-pointer flex-col items-center gap-1.5 rounded-lg disabled:cursor-default">
                {mark}
              </button>
            ) : (
              mark
            )}
          </li>
        );
      })}
    </ol>
  );
}

// Màn chỉ có khối này (H0, lỗi tải) thì tiêu đề là h1; màn có AppHead thì là h2.
export function EndBlock({ title, hint, mark, icon, main }: { title: string; hint?: string; mark?: boolean; icon?: ReactNode; main?: boolean }) {
  const Heading = main ? "h1" : "h2";
  return (
    <div className="anim-stagger flex flex-1 flex-col items-center justify-center gap-2 py-10 text-center">
      {(mark || icon) && (
        <span aria-hidden className="mb-1 grid size-14 place-items-center rounded-full bg-accent-soft text-xl font-bold text-accent-ink">
          {icon ?? "!"}
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
    <a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-sm hover:bg-surface">
      <QrPreview value={url} label="QR kết bạn Zalo" size={56} />
      <span className="text-sm text-text-2">{text}</span>
    </a>
  );
}

export function Bottom({ children }: { children: ReactNode }) {
  return <div className="mt-auto flex flex-col gap-2 pt-6">{children}</div>;
}
