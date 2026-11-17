"use client";

import { ChevronDown, ClipboardCheck, Clock, ExternalLink, Gift, HeartHandshake, ShieldCheck } from "lucide-react";
import { QrPreview } from "@/components/settings/QrPreview";
import { Button } from "@/components/ui/Button";
import { StatusTag, type Tone } from "@/components/ui/StatusTag";
import { formatDateTime } from "@/lib/dates";
import type { CustomerBankStatus, StudentState } from "@/lib/studentState";
import { GIFT_LABEL } from "./GiftDialog";
import { AppHead, Bottom, ZaloBox } from "./parts";

const STATUS: Record<CustomerBankStatus, { label: string; tone: Tone }> = {
  selected: { label: "Đang tạo", tone: "neutral" },
  pending: { label: "Chờ kiểm tra", tone: "progress" },
  passed: { label: "Đạt", tone: "ok" },
  failed: { label: "Không đạt", tone: "danger" },
};

function PviQr({ state }: { state: StudentState }) {
  if (!state.voucher || !state.pviAppUrl) return null;
  return (
    <section aria-label="App PVI" className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <QrPreview value={state.pviAppUrl} label="QR mở app PVI" />
      <a
        href={state.pviAppUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex h-11 items-center gap-2 rounded-[10px] bg-accent px-4 text-sm font-semibold text-on-accent hover:opacity-90"
      >
        <ExternalLink size={16} aria-hidden />
        Mở app PVI
      </a>
    </section>
  );
}

// Ba sản phẩm bảo hiểm PVI: mỗi thẻ có hướng dẫn mua gấp lại và nút mở MyPVI. Sản phẩm chưa có link thì không hiện.
function Insurance({ list }: { list: StudentState["insurance"] }) {
  if (!list.length) return null;
  return (
    <section aria-labelledby="insurance-title" className="mt-5 flex flex-col gap-3">
      <h2 id="insurance-title" className="flex items-center gap-2 text-[15px] font-semibold">
        <ShieldCheck size={18} aria-hidden className="text-accent-ink" />
        Mời bạn chọn bảo hiểm
      </h2>
      <ul className="anim-stagger flex flex-col gap-3">
        {list.map((p) => (
          <li key={p.key} className="flex flex-col gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
            <h3 className="text-[15px] font-semibold">{p.name}</h3>
            {p.guide && (
              <details className="group rounded-xl bg-surface px-3.5 py-2.5 text-sm">
                <summary className="flex cursor-pointer list-none items-center justify-between font-medium text-accent-ink [&::-webkit-details-marker]:hidden">
                  Hướng dẫn mua
                  <ChevronDown size={16} aria-hidden className="transition-transform duration-200 group-open:rotate-180" />
                </summary>
                <p className="mt-2 leading-relaxed whitespace-pre-line text-text-2">{p.guide}</p>
              </details>
            )}
            <a href={p.url} target="_blank" rel="noopener noreferrer" className="inline-flex h-10 items-center gap-2 self-start rounded-[10px] border border-accent px-4 text-sm font-semibold text-accent-ink hover:bg-accent-soft/40">
              <ExternalLink size={16} aria-hidden />
              Mua trên MyPVI
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

// Quà 20.000 đồng: đã khai tài khoản thì hiện nơi nhận và trạng thái chuyển; đủ điều kiện mà chưa khai thì có nút nhập.
function GiftCard({ gift, onGift }: { gift: StudentState["gift"]; onGift: () => void }) {
  if (!gift.eligible) return null;
  return (
    <section aria-label={`Quà ${GIFT_LABEL}`} className="mt-4 flex items-center gap-3 rounded-2xl border border-line bg-card p-4 shadow-sm">
      <span aria-hidden className="grid size-10 flex-none place-items-center rounded-full bg-accent-soft text-accent-ink">
        <Gift size={20} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5 text-sm">
        <strong className="text-[15px]">Quà {GIFT_LABEL}</strong>
        {gift.claim ? (
          <>
            <span className="text-text-2 wrap-anywhere">
              {gift.claim.bankName} <span className="font-mono text-text">{gift.claim.accountNumber}</span>
            </span>
            <span className="text-text-2">{gift.claim.paidAt ? `Đã chuyển ${formatDateTime(gift.claim.paidAt)}` : "Chờ chuyển"}</span>
          </>
        ) : (
          <span className="text-text-2">Mở từ ngân hàng thứ hai.</span>
        )}
      </div>
      {!gift.claim && (
        <Button variant="secondary" onClick={onGift}>
          Nhận quà
        </Button>
      )}
    </section>
  );
}

export function Result({ state, onAddMore, onGift }: { state: StudentState; onAddMore?: () => void; onGift: () => void }) {
  return (
    <>
      <AppHead title={`${state.customer.fullName} - ${state.customer.className}`} />
      <p className="flex items-center gap-2 text-sm text-text-2">
        {(state.reviewedAt || state.submittedAt) && (
          <span aria-hidden className="anim-pop grid size-9 flex-none place-items-center rounded-full bg-accent-soft text-accent-ink">
            {state.reviewedAt ? <ClipboardCheck size={18} /> : <Clock size={18} />}
          </span>
        )}
        {state.reviewedAt
          ? `Kiểm tra xong ${formatDateTime(state.reviewedAt)}`
          : state.submittedAt
            ? `Đã gửi ${formatDateTime(state.submittedAt)}. Nhân viên kiểm tra trong giờ làm việc.`
            : ""}
      </p>
      <ul aria-label="Ngân hàng đã gửi" className="anim-stagger my-4 flex flex-col divide-y divide-line rounded-2xl border border-line bg-card shadow-sm">
        {state.banks.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <strong className="text-[15px]">{b.name}</strong>
            <StatusTag size="md" tone={STATUS[b.status].tone}>{STATUS[b.status].label}</StatusTag>
          </li>
        ))}
      </ul>
      <GiftCard gift={state.gift} onGift={onGift} />
      <PviQr state={state} />
      <Insurance list={state.insurance} />
      {state.thanksText && (
        <p className="mt-5 flex items-center gap-3 rounded-2xl bg-accent-soft/60 px-4 py-3.5 text-[15px] leading-snug font-medium text-accent-ink">
          <HeartHandshake size={22} aria-hidden className="flex-none" />
          {state.thanksText}
        </p>
      )}
      <Bottom>
        {onAddMore && (
          <Button variant="secondary" large block onClick={onAddMore}>
            Mở thêm ngân hàng
          </Button>
        )}
        <ZaloBox url={state.zaloUrl} text="Cần hỏi: kết bạn Zalo với nhân viên." />
      </Bottom>
    </>
  );
}
