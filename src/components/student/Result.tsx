"use client";

import { useState } from "react";
import { QrPreview } from "@/components/settings/QrPreview";
import { Button } from "@/components/ui/Button";
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

function VoucherCard({ state }: { state: StudentState }) {
  const [copied, setCopied] = useState(false);
  const { voucher } = state;
  const waiting = state.banks.some((b) => b.status === "pending");
  return (
    <section aria-labelledby="voucher-title" className="flex flex-col gap-2 rounded-2xl border border-line bg-card p-4">
      <h2 id="voucher-title" className="text-[13px] text-text-2">
        Voucher bảo hiểm
      </h2>
      {voucher ? (
        <>
          <div className="flex items-center gap-3">
            {state.pviAppUrl && (
              <a href={state.pviAppUrl} target="_blank" rel="noopener noreferrer" className="flex-none">
                <QrPreview value={state.pviAppUrl} label="QR mở app PVI" />
              </a>
            )}
            <div className="flex min-w-0 flex-col gap-1">
              <span className="text-[13px] text-text-2">Mã voucher khi mua trên app PVI</span>
              <strong className="break-all font-mono text-lg">{voucher.code}</strong>
              {state.pviAppUrl && <span className="text-[13px] text-text-2">Quét QR để mở app PVI</span>}
            </div>
          </div>
          {voucher.smsSentAt && (
            <span className="text-[13px] text-text-2">
              Đã gửi SMS tới {state.parentPhone} lúc {formatDateTime(voucher.smsSentAt)}
            </span>
          )}
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard?.writeText(voucher.code).catch(() => undefined);
              setCopied(true);
            }}
          >
            {copied ? "Đã sao chép" : "Sao chép mã voucher"}
          </Button>
        </>
      ) : waiting ? (
        <>
          <p className="text-sm font-semibold">Phụ huynh nhận SMS khi có ngân hàng đạt.</p>
          <span className="text-[13px] text-text-2">Gửi tới {state.parentPhone}</span>
        </>
      ) : (
        <p className="text-sm font-semibold">Chưa có. Nhân viên sẽ gọi cho phụ huynh.</p>
      )}
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
            <span className="flex flex-col">
              <strong className="text-[15px]">{b.name}</strong>
              <span className="text-[13px] text-text-2">Ngân hàng {b.slot}</span>
            </span>
            <StatusTag tone={STATUS[b.status].tone}>{STATUS[b.status].label}</StatusTag>
          </li>
        ))}
      </ul>
      <VoucherCard state={state} />
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
