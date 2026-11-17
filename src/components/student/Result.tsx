"use client";

import { ClipboardCheck, Clock, ExternalLink } from "lucide-react";
import { QrPreview } from "@/components/settings/QrPreview";
import { StatusTag, type Tone } from "@/components/ui/StatusTag";
import { shortName } from "@/lib/bankName";
import { formatDateTime } from "@/lib/dates";
import type { CustomerBankStatus, StudentState } from "@/lib/studentState";
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

export function Result({ state }: { state: StudentState }) {
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
            <strong className="text-[15px]">{shortName(b.name)}</strong>
            <StatusTag size="md" tone={STATUS[b.status].tone}>{STATUS[b.status].label}</StatusTag>
          </li>
        ))}
      </ul>
      <PviQr state={state} />
      <Bottom>
        <ZaloBox url={state.zaloUrl} text="Cần hỏi: kết bạn Zalo với nhân viên." />
      </Bottom>
    </>
  );
}
