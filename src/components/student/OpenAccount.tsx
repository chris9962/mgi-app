"use client";

import { clsx } from "clsx";
import { Check, Copy, ExternalLink, Send } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/Button";
import { ImageLightbox } from "@/components/ui/ImageLightbox";
import { StatusTag, type Tone } from "@/components/ui/StatusTag";
import { ConfirmDialog } from "@/components/users/ConfirmDialog";
import { studentApi } from "@/lib/studentApi";
import type { CustomerBankStatus, StudentBank, StudentState } from "@/lib/studentState";
import { AppHead, BankLogo, Bottom, useStepBack, useStepNav } from "./parts";
import { PhotoSlot } from "./PhotoSlot";

const complete = (b: StudentBank) => b.slots.every((s) => s.photo);
const isOpen = (b: StudentBank) => b.status === "selected";

const SENT: Record<Exclude<CustomerBankStatus, "selected">, { label: string; tone: Tone; hint: string }> = {
  pending: { label: "Chờ kiểm tra", tone: "progress", hint: "Đã gửi kiểm tra. Nhân viên kiểm tra trong giờ làm việc." },
  passed: { label: "Đạt", tone: "ok", hint: "Đã kiểm tra xong." },
  failed: { label: "Không đạt", tone: "danger", hint: "Đã kiểm tra xong." },
};

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
    <div className="flex gap-3 rounded-2xl border border-line bg-card p-3 shadow-sm">
      {bank.qrUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bank.qrUrl} alt={`QR mã giới thiệu ${bank.name}`} width={96} height={96} className="size-24 flex-none rounded-lg border border-line bg-white object-contain" />
      )}
      <div className="flex min-w-0 flex-col items-start gap-1.5">
        {bank.referralCode && (
          <>
            <span className="text-[13px] text-text-2">Mã giới thiệu</span>
            {/* Như CopyValue của mgst-app: không chép được bằng nút thì một cú bấm chọn hết mã để chép tay. */}
            <strong className="break-all font-mono text-lg select-all">{bank.referralCode}</strong>
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
                {copy === "copied" ? <Check size={14} aria-hidden className="anim-pop text-ok-ink" /> : <Copy size={14} aria-hidden />}
                Sao chép
              </Button>
              <span aria-live="polite" className={clsx("text-[13px]", copy === "failed" ? "text-danger" : "text-text-2")}>
                {copy === "copied" && <span className="anim-fade inline-block">Đã sao chép</span>}
                {copy === "failed" && <span className="anim-fade inline-block">Không sao chép được</span>}
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

type PanelProps = { bank: StudentBank; onSaved: () => Promise<void>; onBusy: (slotId: string, busy: boolean) => void };

function BankPanel({ bank, onSaved, onBusy }: PanelProps) {
  const done = bank.slots.filter((s) => s.photo).length;
  const samples = bank.slots.flatMap((s, i) => (s.sampleUrl ? [{ slotId: s.id, src: s.sampleUrl, alt: `Ảnh mẫu ${s.name}`, caption: `${i + 1}. ${s.name}` }] : []));
  const [sampleAt, setSampleAt] = useState<number | null>(null);
  if (!isOpen(bank)) {
    const sent = SENT[bank.status as Exclude<CustomerBankStatus, "selected">];
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
        <StatusTag size="md" tone={sent.tone}>
          {sent.label}
        </StatusTag>
        <p className="text-sm text-text-2">{sent.hint}</p>
      </div>
    );
  }
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

// onBackToBanks: đã gửi ít nhất một ngân hàng mà quay lại bước 2 thì chọn thêm trong số ngân hàng còn lại, không rơi về màn Kết quả.
type Props = { state: StudentState; onChange: () => Promise<void>; onEdit: () => Promise<string | null>; onSubmitted?: (submitted: number) => void; onBackToBanks?: () => Promise<void> };

export function OpenAccount({ state, onChange, onEdit, onSubmitted, onBackToBanks }: Props) {
  const banks = state.banks;
  const open = banks.filter(isOpen);
  const sent = banks.filter((b) => !isOpen(b));
  const [active, setActive] = useState(open[0]?.id ?? banks[0]?.id ?? "");
  const [confirmBack, setConfirmBack] = useState<1 | 2 | null>(null);
  const [confirmStop, setConfirmStop] = useState(false);
  // Ngân hàng đang hỏi "đã hoàn thành chưa" trước khi gửi.
  const [confirmSubmit, setConfirmSubmit] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sending, setSending] = useState(false);
  const nav = useStepNav();
  const leaving = nav.pending;
  const setLeaving = nav.setPending;
  const [busySlots, setBusySlots] = useState<string[]>([]);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);
  const focusError = useRef(false);
  const current = banks.find((b) => b.id === active) ?? banks[0];
  const hasPhoto = open.some((b) => b.slots.some((s) => s.photo));
  const markBusy = (slotId: string, busy: boolean) => setBusySlots((list) => (busy ? [...list, slotId] : list.filter((id) => id !== slotId)));
  // Ảnh vừa nộp có thể lấp đúng khung mà câu lỗi đang nhắc: câu cũ không được ở lại tới lần bấm sau.
  const photoSaved = () => {
    setError("");
    return onChange();
  };

  // Không có nút gửi riêng: hộp "đã hoàn thành chưa" tự mở khi ngân hàng vừa đủ ảnh (feedback 2026-11-16), và khi vào màn
  // mà còn ngân hàng đủ ảnh chưa gửi (kể cả ngân hàng không có khung ảnh), nên bấm Huỷ rồi cũng không kẹt.
  const wasComplete = useRef(new Map<string, boolean>());
  useEffect(() => {
    let ask: string | null = null;
    for (const b of banks) {
      const before = wasComplete.current.get(b.id) ?? false;
      const now = complete(b);
      wasComplete.current.set(b.id, now);
      if (!before && now && isOpen(b)) ask ??= b.id;
    }
    if (ask) setConfirmSubmit(ask);
  }, [banks]);

  async function submitBank(id: string) {
    setSending(true);
    setError("");
    setConfirmSubmit(null);
    const r = await studentApi<{ submitted: number }>("POST", `/api/customers/me/banks/${id}/submit`);
    if (r.ok) {
      // Chuyển sang ngân hàng còn đang mở để học sinh làm tiếp; ngân hàng đó đã đủ ảnh thì hỏi gửi luôn, quà hỏi sau khi gửi hết.
      const next = open.find((b) => b.id !== id);
      if (next) setActive(next.id);
      await onChange();
      setSending(false);
      if (next && complete(next)) setConfirmSubmit(next.id);
      else onSubmitted?.(r.data.submitted);
      return;
    }
    // Hồ sơ đã đổi ở máy chủ (tab khác đã gửi, người quản lý thêm khung ảnh): tải lại để màn khớp máy chủ.
    if (r.status === 400 || r.status === 409) await onChange();
    setSending(false);
    setError(r.message);
  }

  // Bỏ các ngân hàng chưa gửi: quay lại bước 2, hay dừng mở thêm sau khi đã gửi ít nhất một ngân hàng.
  async function dropOpen(target: 1 | 2 | "stop"): Promise<string | null> {
    if (target !== "stop") setLeaving(target);
    setError("");
    const r = await studentApi("DELETE", "/api/customers/me/banks");
    if (r.ok) {
      // Máy chủ xoá xong mới chuyển màn. Không mở được màn sửa thông tin thì về bước chọn ngân hàng.
      if (target === 2 && sent.length && onBackToBanks) await onBackToBanks();
      else if (target !== 1 || (await onEdit())) await onChange();
      return null;
    }
    // Hồ sơ đã đổi ở máy chủ (trường vừa đóng, tab khác đã gửi kiểm tra): tải lại để màn khớp máy chủ, báo lỗi ở màn chứ không ở hộp hỏi.
    if (r.status === 409) {
      await onChange();
      // Nút vừa bấm đã ẩn sau khi tải lại: không chuyển tiêu điểm thì nó rơi về đầu trang.
      focusError.current = true;
      setConfirmBack(null);
      setConfirmStop(false);
      setError(r.message);
      setLeaving(null);
      return null;
    }
    setLeaving(null);
    return r.message;
  }

  useStepBack(nav, askBack);
  async function askBack(target: 1 | 2) {
    // Đã gửi một ngân hàng thì họ tên, lớp, SĐT phụ huynh khoá theo (chốt 2026-11-17).
    if (target === 1 && sent.length) return setError("Đã gửi kiểm tra, không sửa được thông tin.");
    if (hasPhoto) return setConfirmBack(target);
    const message = await dropOpen(target);
    if (message) setError(message);
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

  const asking = confirmSubmit ? banks.find((b) => b.id === confirmSubmit) : undefined;
  return (
    <>
      <AppHead title="Mở tài khoản" subtitle={state.school.name} />
      {/* Tên đầy đủ dài và có thể nhiều ngân hàng: tab là thẻ logo cuộn ngang, tên hiện ở dòng dưới thanh tab; không có logo thì tab ghi tên. */}
      <div role="tablist" aria-label="Ngân hàng đã chọn" className="sticky top-0 z-10 -mx-4 flex gap-2 overflow-x-auto bg-bg px-4 pt-1 pb-2.5 [scrollbar-width:none]">
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
            className={clsx(
              "relative w-[104px] flex-none rounded-xl border p-1.5 transition-colors duration-200",
              b.id === current.id ? "border-accent bg-accent-soft/40 ring-1 ring-accent" : "border-field-border bg-card",
              !isOpen(b) && "opacity-80",
            )}
          >
            {b.logoUrl ? <BankLogo src={b.logoUrl} /> : <span aria-hidden className="line-clamp-2 min-h-9 text-[12px] leading-tight font-semibold">{b.name}</span>}
            <span className="sr-only">
              {b.name}
              {!isOpen(b) ? ", đã gửi" : complete(b) ? ", đủ ảnh" : ", chưa đủ ảnh"}
            </span>
            {(!isOpen(b) || complete(b)) && (
              <span aria-hidden className={clsx("anim-pop absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full text-on-accent ring-2 ring-bg", isOpen(b) ? "bg-ok" : "bg-text-2")}>
                {isOpen(b) ? <Check size={12} strokeWidth={3} /> : <Send size={10} strokeWidth={3} />}
              </span>
            )}
          </button>
        ))}
      </div>
      <h2 className="mb-3 text-[15px] leading-snug font-semibold">{current.name}</h2>
      {banks.map((b) => (
        <div key={b.id} role="tabpanel" id={`panel-${b.id}`} aria-labelledby={`tab-${b.id}`} hidden={b.id !== current.id} className="anim-rise">
          <BankPanel bank={b} onSaved={photoSaved} onBusy={markBusy} />
        </div>
      ))}
      {error && (
        <p
          ref={(el) => {
            if (!el || !focusError.current) return;
            focusError.current = false;
            el.focus();
          }}
          tabIndex={-1}
          role="alert"
          className="mt-3 text-sm text-danger"
        >
          {error}
        </p>
      )}
      <Bottom>
        {state.school.active && open.length > 0 && (
          <Button variant="secondary" large block disabled={leaving !== null || sending} onClick={() => askBack(2)}>
            Quay lại chọn ngân hàng
          </Button>
        )}
        {sent.length > 0 && open.length > 0 && (
          <Button variant="secondary" large block disabled={leaving !== null || sending} onClick={() => setConfirmStop(true)}>
            Không mở thêm ngân hàng
          </Button>
        )}
      </Bottom>
      {/* Chỉ dựng hộp khi mở, như các trang quản lý: mở lại thì không còn câu lỗi của lần trước. */}
      {asking && (
        <ConfirmDialog
          open
          title="Gửi kiểm tra"
          text={`Đã hoàn thành ${asking.name}?`}
          confirmLabel="Gửi kiểm tra"
          busy={sending || asking.slots.some((s) => busySlots.includes(s.id))}
          onConfirm={async () => {
            await submitBank(asking.id);
            return null;
          }}
          onClose={() => setConfirmSubmit(null)}
        />
      )}
      {confirmBack && (
        <ConfirmDialog
          open
          title={confirmBack === 1 ? "Quay lại thông tin" : "Quay lại chọn ngân hàng"}
          text={confirmBack === 1 ? "Xoá ảnh đã nộp và quay lại sửa thông tin?" : "Xoá ảnh đã nộp của ngân hàng chưa gửi và quay lại chọn ngân hàng?"}
          confirmLabel="Quay lại"
          danger
          onConfirm={() => dropOpen(confirmBack)}
          onClose={() => setConfirmBack(null)}
        />
      )}
      {confirmStop && (
        <ConfirmDialog
          open
          title="Không mở thêm ngân hàng"
          text="Bỏ các ngân hàng chưa gửi và xem kết quả?"
          confirmLabel="Không mở thêm"
          danger
          onConfirm={() => dropOpen("stop")}
          onClose={() => setConfirmStop(false)}
        />
      )}
    </>
  );
}
