"use client";

import { ExternalLink } from "lucide-react";
import { QrPreview } from "@/components/settings/QrPreview";
import { StatusTag, type Tone } from "@/components/ui/StatusTag";
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
    <section aria-label="App PVI" className="flex items-center gap-3 rounded-2xl border border-line bg-card p-4">
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
  const failedWithPass = state.voucher ? state.banks.filter((b) => b.status === "failed") : [];
  return (
    <>
      <AppHead school={state.school.name} title={`${state.customer.fullName} - ${state.customer.className}`} />
      <p className="text-sm text-text-2">
        {state.reviewedAt
          ? `Kiểm tra xong ${formatDateTime(state.reviewedAt)}`
          : state.submittedAt
            ? `Đã gửi ${formatDateTime(state.submittedAt)}. Nhân viên kiểm tra trong giờ làm việc.`
            : ""}
      </p>
      <ul aria-label="Ngân hàng đã gửi" className="my-4 flex flex-col divide-y divide-line rounded-2xl border border-line bg-card">
        {state.banks.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <strong className="text-[15px]">{b.name}</strong>
            <StatusTag tone={STATUS[b.status].tone}>{STATUS[b.status].label}</StatusTag>
          </li>
        ))}
      </ul>
      <PviQr state={state} />
      {failedWithPass.map((b) => (
        <p key={b.id} className="mt-3 text-sm text-text-2">
          {b.name} không đạt: nhân viên gọi cho phụ huynh để hướng dẫn.
        </p>
      ))}
      <Bottom>
        <ZaloBox url={state.zaloUrl} text="Cần hỏi: kết bạn Zalo với nhân viên." />
      </Bottom>
    </>
  );
}
