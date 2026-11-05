"use client";

import { clsx } from "clsx";
import { useState, type ChangeEvent } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { compressImage, contentTypeOf } from "@/lib/compressImage";
import { MAX_IMAGE_BYTES } from "@/lib/imageKey";
import { studentApi } from "@/lib/studentApi";
import type { StudentPhotoSlot } from "@/lib/studentState";

const kb = (bytes: number) => `${Math.max(1, Math.round(bytes / 1024))} KB`;

async function upload(customerBankId: string, slotId: string, file: File): Promise<string | null> {
  const compressed = await compressImage(file);
  const contentType = compressed?.type || contentTypeOf(file);
  const body: Blob = compressed ?? file;
  if (!contentType) return "Không mở được ảnh này. Chọn ảnh khác.";
  if (body.size > MAX_IMAGE_BYTES) return "Ảnh lớn hơn 10 MB.";
  const link = await studentApi<{ url: string; key: string }>("POST", "/api/customers/me/photos/upload-url", { customerBankId, slotId, contentType, size: body.size });
  if (!link.ok) return link.message;
  const put = await fetch(link.data.url, { method: "PUT", headers: { "Content-Type": contentType }, body }).catch(() => null);
  if (!put?.ok) return "Không tải được ảnh lên. Kiểm tra mạng rồi thử lại.";
  const saved = await studentApi("POST", "/api/customers/me/photos", { customerBankId, slotId, key: link.data.key });
  return saved.ok ? null : saved.message;
}

export function PhotoSlot({
  index,
  customerBankId,
  slot,
  onSaved,
  onBusy,
}: {
  index: number;
  customerBankId: string;
  slot: StudentPhotoSlot;
  onSaved: () => Promise<void>;
  onBusy: (slotId: string, busy: boolean) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [viewSample, setViewSample] = useState(false);

  async function pick(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusy(true);
    onBusy(slot.id, true);
    setError("");
    let message: string | null = null;
    // Lỗi bất ngờ (trình duyệt, máy chủ trả dữ liệu lạ) không được để khung đứng mãi ở "Đang tải ảnh".
    try {
      message = await upload(customerBankId, slot.id, file);
      if (!message) await onSaved();
    } catch {
      message = "Không tải được ảnh lên. Thử lại.";
    } finally {
      setBusy(false);
      onBusy(slot.id, false);
    }
    setError(message ?? "");
  }

  return (
    <li className="flex flex-col gap-2">
      <span className="text-sm font-semibold">
        {index}. {slot.name}
      </span>
      <div className="grid grid-cols-2 gap-2">
        {slot.sampleUrl ? (
          <button type="button" onClick={() => setViewSample(true)} className="relative h-40 overflow-hidden rounded-xl border border-line bg-surface" aria-label={`Xem ảnh mẫu ${slot.name}`}>
            {/* Link S3 có hạn, không đi qua bộ tối ưu ảnh của Next. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={slot.sampleUrl} alt="" className="size-full object-cover" />
            <span className="absolute inset-x-0 bottom-0 bg-card/90 py-1 text-center text-xs font-semibold text-text">Ảnh mẫu</span>
          </button>
        ) : (
          <span className="grid h-40 place-items-center rounded-xl border border-dashed border-line text-center text-xs text-text-2">Chưa có ảnh mẫu</span>
        )}
        <label
          className={clsx(
            "relative flex h-40 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 text-center text-sm focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
            slot.photo ? "border-ok bg-card" : "border-dashed border-field-border bg-card text-text-2",
          )}
        >
          <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={pick} aria-label={`${slot.name}: ${slot.photo ? "chụp lại" : "chụp hoặc chọn ảnh"}`} />
          {slot.photo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slot.photo.url} alt="" className="absolute inset-0 size-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 flex flex-col bg-card/90 py-1 text-xs font-semibold text-text">
                <span className="text-ok-ink">
                  <span aria-hidden>✓ </span>Đã nộp {kb(slot.photo.sizeBytes)}
                </span>
                <span>Chụp lại</span>
              </span>
            </>
          ) : (
            <>
              <span aria-hidden className="text-2xl leading-none">
                +
              </span>
              <span>Chụp hoặc chọn ảnh</span>
            </>
          )}
          {busy && (
            <span role="status" className="absolute inset-0 grid place-items-center bg-card/90 text-sm font-semibold text-text">
              Đang tải ảnh
            </span>
          )}
        </label>
      </div>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
      {viewSample && slot.sampleUrl && (
        <Dialog open title={`Ảnh mẫu: ${slot.name}`} onClose={() => setViewSample(false)} width={520}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={slot.sampleUrl} alt={`Ảnh mẫu ${slot.name}`} className="max-h-[70dvh] w-full rounded-lg object-contain" />
        </Dialog>
      )}
    </li>
  );
}
