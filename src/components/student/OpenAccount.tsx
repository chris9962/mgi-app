"use client";

import { clsx } from "clsx";
import { Check, Copy, ExternalLink } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { ConfirmDialog } from "@/components/users/ConfirmDialog";
import { studentApi } from "@/lib/studentApi";
import type { StudentBank, StudentState } from "@/lib/studentState";
import { AppHead, Bottom, Steps } from "./parts";
import { PhotoSlot } from "./PhotoSlot";

const complete = (b: StudentBank) => b.slots.every((s) => s.photo);

function CodeBox({ bank }: { bank: StudentBank }) {
  const [copy, setCopy] = useState<"idle" | "copied" | "failed">("idle");
  // Như CopyButton của mgst-app: câu báo tự mất sau 2 giây; hẹn giờ là hệ ngoài React nên dọn khi state đổi hoặc khung biến mất.
  useEffect(() => {
    if (copy === "idle") return;
    const timer = setTimeout(() => setCopy("idle"), 2000);
    return () => clearTimeout(timer);
  }, [copy]);
  if (!bank.referralCode && !bank.qrUrl && !bank.openUrl) return null;
  return (
    <div className="flex gap-3 rounded-2xl border border-line bg-card p-3">
      {bank.qrUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bank.qrUrl} alt={`QR mã giới thiệu ${bank.name}`} width={96} height={96} className="size-24 flex-none rounded-lg border border-line bg-white object-contain" />
      )}
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        {bank.referralCode && (
          <>
            <span className="text-[13px] text-text-2">Mã giới thiệu</span>
            <strong className="break-all font-mono text-lg">{bank.referralCode}</strong>
            {/* Vùng báo nằm cùng hàng với nút: lúc rỗng không thêm hàng trống. */}
            <div className="flex flex-wrap items-center gap-x-2">
              <Button
                variant="secondary"
                onClick={async () => {
                  // Trình duyệt trong app Zalo hay trang http không có clipboard: không được báo đã chép.
                  try {
                    await navigator.clipboard.writeText(bank.referralCode);
                    setCopy("copied");
                  } catch {
                    setCopy("failed");
                  }
                }}
              >
                {copy === "copied" ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />}
                Sao chép
              </Button>
              <span aria-live="polite" className={clsx("text-[13px]", copy === "failed" ? "text-danger" : "text-text-2")}>
                {copy === "copied" && "Đã sao chép"}
                {copy === "failed" && "Không sao chép được"}
              </span>
            </div>
          </>
        )}
        {bank.openUrl && (
          <a
            href={bank.openUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-line bg-card px-3.5 text-sm font-semibold text-text hover:bg-surface"
          >
            <ExternalLink size={14} aria-hidden />
            Quét QR code
          </a>
        )}
      </div>
    </div>
  );
}

function BankPanel({ bank, onSaved, onBusy }: { bank: StudentBank; onSaved: () => Promise<void>; onBusy: (slotId: string, busy: boolean) => void }) {
  const done = bank.slots.filter((s) => s.photo).length;
  const samples = bank.slots.flatMap((s, i) => (s.sampleUrl ? [{ slotId: s.id, src: s.sampleUrl, alt: `Ảnh mẫu ${s.name}`, caption: `${i + 1}. ${s.name}` }] : []));
  const [sampleAt, setSampleAt] = useState<number | null>(null);
  return (
    <div className="flex flex-col gap-4">
      {bank.steps.length > 0 && (
        <ol className="flex list-decimal flex-col gap-1.5 pl-5 text-sm">
          {bank.steps.map((step, i) => (
            <li key={i}>{step}</li>
          ))}
        </ol>
      )}
      <CodeBox bank={bank} />
      {bank.slots.length > 0 && (
        <section aria-label={`Ảnh cần nộp ${bank.name}`} className="flex flex-col gap-2">
          <h3 className="text-[13px] text-text-2">
            Ảnh cần nộp {done}/{bank.slots.length}
          </h3>
          <ul className="flex flex-col gap-4">
            {bank.slots.map((slot, i) => (
              <PhotoSlot
                key={slot.id}
                index={i + 1}
                customerBankId={bank.id}
                slot={slot}
                onSaved={onSaved}
                onBusy={onBusy}
                onViewSample={() => setSampleAt(samples.findIndex((s) => s.slotId === slot.id))}
              />
            ))}
          </ul>
        </section>
      )}
      {sampleAt !== null && <ImageLightbox photos={samples} startIndex={sampleAt} onClose={() => setSampleAt(null)} />}
    </div>
  );
}

export function OpenAccount({ state, onChange }: { state: StudentState; onChange: () => Promise<void> }) {
  const banks = state.banks;
  const [active, setActive] = useState(banks[0]?.id ?? "");
  const [confirmBack, setConfirmBack] = useState(false);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [busySlots, setBusySlots] = useState<string[]>([]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const current = banks.find((b) => b.id === active) ?? banks[0];
  const hasPhoto = banks.some((b) => b.slots.some((s) => s.photo));
  // Đang tải hoặc chụp lại ảnh thì chưa gửi: gửi lúc đó là gửi ảnh cũ, ảnh mới bị bỏ.
  const ready = banks.length > 0 && banks.every(complete) && busySlots.length === 0;
  const markBusy = (slotId: string, busy: boolean) => setBusySlots((list) => (busy ? [...list, slotId] : list.filter((id) => id !== slotId)));
  // Ảnh vừa nộp có thể lấp đúng khung mà câu lỗi đang nhắc: câu cũ không được ở lại tới lần bấm sau.
  const photoSaved = () => {
    setError("");
    return onChange();
  };

  async function submit() {
    setSending(true);
    setError("");
    const r = await studentApi("POST", "/api/customers/me/submit");
    if (r.ok) return onChange();
    // Hồ sơ đã đổi ở máy chủ (tab khác đã gửi, người quản lý thêm khung ảnh): tải lại để màn khớp máy chủ.
    if (r.status === 400 || r.status === 409) await onChange();
    setSending(false);
    setError(r.message);
  }

  async function back(): Promise<string | null> {
    setLeaving(true);
    setError("");
    const r = await studentApi("DELETE", "/api/customers/me/banks");
    if (r.ok) {
      await onChange();
      return null;
    }
    // Hồ sơ đã đổi ở máy chủ (trường vừa đóng, tab khác đã gửi kiểm tra): tải lại để màn khớp máy chủ, báo lỗi ở màn chứ không ở hộp hỏi.
    if (r.status === 409) {
      await onChange();
      setConfirmBack(false);
      setError(r.message);
      setLeaving(false);
      return null;
    }
    setLeaving(false);
    return r.message;
  }

  // Bàn phím trong tablist: mũi tên trái phải chuyển tab theo mẫu tab của WAI-ARIA.
  function onTabKey(event: KeyboardEvent, i: number) {
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    const next = (i + step + banks.length) % banks.length;
    setActive(banks[next].id);
    tabs.current[next]?.focus();
  }

  return (
    <>
      <AppHead school={state.school.name} title="Mở tài khoản" />
      <Steps current={3} />
      {/* Grid chia chỗ đều tới khi tab ngắn đủ chỗ, phần còn lại cho tab dài; flex bóp hai tab theo độ dài nên tên ngắn vỡ từng chữ. */}
      <div role="tablist" aria-label="Ngân hàng đã chọn" className="sticky top-0 z-10 -mx-4 mb-4 grid grid-flow-col justify-start gap-2 border-b border-line bg-bg px-4">
        {banks.map((b, i) => (
          <button
            key={b.id}
            ref={(el) => {
              tabs.current[i] = el;
            }}
            type="button"
            role="tab"
            id={`tab-${b.id}`}
            aria-controls={`panel-${b.id}`}
            aria-selected={b.id === current.id}
            tabIndex={b.id === current.id ? 0 : -1}
            onClick={() => setActive(b.id)}
            onKeyDown={(e) => onTabKey(e, i)}
            className={clsx("-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-[15px] font-semibold", b.id === current.id ? "border-accent text-text" : "border-transparent text-text-2")}
          >
            <span aria-hidden className={clsx("grid size-4 flex-none place-items-center rounded-full text-[10px] leading-none", complete(b) ? "border border-ok bg-ok-soft text-ok-ink" : "border border-field-border")}>
              {complete(b) ? "✓" : ""}
            </span>
            {b.name}
            <span className="sr-only">{complete(b) ? ", đủ ảnh" : ", chưa đủ ảnh"}</span>
          </button>
        ))}
      </div>
      {banks.map((b) => (
        <div key={b.id} role="tabpanel" id={`panel-${b.id}`} aria-labelledby={`tab-${b.id}`} hidden={b.id !== current.id}>
          <BankPanel bank={b} onSaved={photoSaved} onBusy={markBusy} />
        </div>
      ))}
      {error && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      )}
      <Bottom>
        {state.school.active && (
          <Button
            variant="secondary"
            large
            block
            disabled={leaving}
            onClick={async () => {
              if (hasPhoto) return setConfirmBack(true);
              const message = await back();
              if (message) setError(message);
            }}
          >
            Quay lại chọn ngân hàng
          </Button>
        )}
        <Button large block disabled={!ready || sending} onClick={submit}>
          Gửi kiểm tra
        </Button>
      </Bottom>
      <ConfirmDialog
        open={confirmBack}
        title="Quay lại chọn ngân hàng"
        text="Xoá ảnh đã nộp và quay lại chọn ngân hàng?"
        confirmLabel="Quay lại"
        danger
        onConfirm={back}
        onClose={() => setConfirmBack(false)}
      />
    </>
  );
}
