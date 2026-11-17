import { clsx } from "clsx";
import { Check, Landmark } from "lucide-react";
import { createContext, use, useImperativeHandle, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { BRAND_SHORT } from "@/lib/brand";
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

// Đầu trang đứng yên khi đổi bước: StudentApp giữ logo, thanh bước và chỗ chứa tiêu đề; mỗi màn đưa tiêu đề của mình vào chỗ chứa đó.
export const HeadSlotContext = createContext<HTMLElement | null>(null);

// subtitle: tên trường, để học sinh biết mình đang khai cho trường nào.
export function AppHead({ title, subtitle }: { title: string; subtitle?: string }) {
  const slot = use(HeadSlotContext);
  if (!slot) return null;
  return createPortal(
    <>
      <span className="text-xs font-semibold tracking-wide text-text-2">{BRAND_SHORT}</span>
      <h1 className="anim-fade text-lg leading-tight font-bold tracking-tight">{title}</h1>
      {subtitle && <p className="text-[12.5px] leading-snug text-text-2 wrap-anywhere">{subtitle}</p>}
    </>,
    slot,
  );
}

type BackStep = 1 | 2;
type StepNav = { pending: BackStep | null; setPending: (step: BackStep | null) => void; handle: RefObject<((step: BackStep) => void) | null> };

// Thanh bước nằm ở StudentApp để không dựng lại khi đổi màn; màn đang đứng giữ phần xử lý khi bấm bước đã xong.
export const StepNavContext = createContext<StepNav | null>(null);

export function useStepNav() {
  return use(StepNavContext)!;
}

export function useStepBack(nav: StepNav, onBack: (step: BackStep) => void) {
  useImperativeHandle(nav.handle, () => onBack);
}

const STEP_LABEL = ["Thông tin", "Chọn ngân hàng", "Mở tài khoản"];
// Mỗi bước cách nhau 44px: vòng tròn 28px và đoạn nối 16px.
const DISC_AT = ["translate-x-0", "translate-x-11", "translate-x-22"];
const CELL = "col-start-1 row-start-1 transition duration-300";
const HIDDEN = "scale-50 opacity-0";

// onBack: cho bấm các bước đã xong để quay lại; pendingStep là bước đang chờ máy chủ trước khi chuyển màn.
export function Steps({ current, onBack, pendingStep }: { current: 1 | 2 | 3; onBack?: (step: BackStep) => void; pendingStep?: BackStep | null }) {
  return (
    <div className="relative isolate flex-none">
      <span aria-hidden className={clsx("absolute top-0 left-0 -z-10 size-7 rounded-full bg-accent ring-4 ring-accent/20 transition-transform duration-500 ease-(--ease-out)", DISC_AT[current - 1])} />
      <ol aria-label="Các bước" className="flex items-center">
        {STEP_LABEL.map((label, i) => {
          const n = i + 1;
          const state = n < current ? "done" : n === current ? "on" : "todo";
          const pending = pendingStep === n;
          const name = state === "done" ? `${label}, đã xong` : label;
          const canBack = onBack && state === "done";
          return (
            <li key={label} aria-current={state === "on" ? "step" : undefined} className="flex items-center">
              <span
                className={clsx(
                  "relative grid size-7 flex-none place-items-center rounded-full border text-[13px] font-semibold transition-colors duration-300",
                  state === "on" && "border-transparent text-on-accent delay-150",
                  state === "done" && "border-ok bg-ok-soft text-ok-ink",
                  state === "todo" && "border-field-border bg-card text-text-2",
                )}
              >
                <span aria-hidden className={clsx(CELL, (state === "done" || pending) && HIDDEN)}>
                  {n}
                </span>
                <Check size={16} strokeWidth={3} aria-hidden className={clsx(CELL, (state !== "done" || pending) && HIDDEN)} />
                {pending && <span aria-hidden className="col-start-1 row-start-1 size-4 animate-spin rounded-full border-2 border-ok/30 border-t-ok-ink" />}
                {canBack ? (
                  <button type="button" aria-label={name} disabled={pendingStep != null} onClick={() => onBack(n as BackStep)} className="absolute inset-0 cursor-pointer rounded-full disabled:cursor-default" />
                ) : (
                  <span className="sr-only">{name}</span>
                )}
              </span>
              {n < 3 && (
                <span aria-hidden className="mx-0.5 h-0.5 w-3 overflow-hidden rounded bg-line">
                  <span className={clsx("block size-full origin-left bg-ok transition-transform duration-500 ease-(--ease-out)", n < current ? "scale-x-100" : "scale-x-0")} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
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

// sticky: nút chính luôn nằm ở mép dưới màn hình khi nội dung dài hơn màn hình; -mb-6 bù khoảng đệm dưới của khung trang.
export function Bottom({ children, sticky }: { children: ReactNode; sticky?: boolean }) {
  if (sticky)
    return (
      <div className="sticky bottom-0 z-10 -mx-4 mt-auto -mb-6 pt-6">
        <div className="flex flex-col gap-2 border-t border-line bg-bg/95 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur">{children}</div>
      </div>
    );
  return <div className="mt-auto flex flex-col gap-2 pt-6">{children}</div>;
}
