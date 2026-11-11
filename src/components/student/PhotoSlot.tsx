"use client";

import { clsx } from "clsx";
import { useState, type ChangeEvent } from "react";
import { compressImage, contentTypeOf } from "@/lib/compressImage";
import { MAX_IMAGE_BYTES } from "@/lib/imageKey";
import { studentApi } from "@/lib/studentApi";
import type { StudentPhotoSlot } from "@/lib/studentState";

// stale: khung đã bị bỏ hoặc hồ sơ đã rời B3 ở máy chủ.
async function upload(customerBankId: string, slotId: string, file: File): Promise<{ message: string; stale?: boolean } | null> {
  const compressed = await compressImage(file);
  if (!compressed && !contentTypeOf(file)) return { message: "Không mở được ảnh này. Chọn ảnh khác." };
  const body: Blob = compressed ?? file;
  if (body.size > MAX_IMAGE_BYTES) return { message: "Ảnh lớn hơn 20 MB." };
  const form = new FormData();
  form.append("customerBankId", customerBankId);
  form.append("slotId", slotId);
  form.append("file", body, file.name);
  const saved = await studentApi("POST", "/api/customers/me/photos", form);
  if (saved.ok) return null;
  return { message: saved.status === 0 ? "Không tải được ảnh lên. Kiểm tra mạng rồi thử lại." : saved.message, stale: saved.status === 404 || saved.status === 409 };
}

export function PhotoSlot({
  index,
  customerBankId,
  slot,
  onSaved,
  onBusy,
  onViewSample,
}: {
  index: number;
  customerBankId: string;
  slot: StudentPhotoSlot;
  onSaved: () => Promise<void>;
  onBusy: (slotId: string, busy: boolean) => void;
  onViewSample: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

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
      const failed = await upload(customerBankId, slot.id, file);
      message = failed?.message ?? null;
      // Khung bị bỏ hay hồ sơ đã đổi ở máy chủ: tải lại để khung biến mất thay vì báo lỗi mãi.
      if (!failed || failed.stale) await onSaved();
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
          <button type="button" onClick={onViewSample} className="relative h-40 overflow-hidden rounded-xl border border-line bg-surface" aria-label={`Xem ảnh mẫu ${slot.name}`}>
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
            "relative flex h-40 cursor-pointer flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border-2 text-center text-sm transition-colors duration-300 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
            slot.photo ? "border-ok bg-card" : "border-dashed border-field-border bg-card text-text-2",
          )}
        >
          <input type="file" accept="image/*" className="sr-only" disabled={busy} onChange={pick} aria-label={`${slot.name}: ${slot.photo ? "chọn lại" : "chọn ảnh"}`} />
          {slot.photo ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={slot.photo.url} alt="" className="anim-fade absolute inset-0 size-full object-cover" />
              <span className="absolute inset-x-0 bottom-0 flex flex-col bg-card/90 py-1 text-xs font-semibold text-text">
                <span className="text-ok-ink">
                  <span aria-hidden>✓ </span>Đã gửi
                </span>
                <span>Chọn lại</span>
              </span>
            </>
          ) : (
            <>
              <span aria-hidden className="text-2xl leading-none">
                +
              </span>
              <span>Chọn ảnh</span>
            </>
          )}
          {busy && (
            <span role="status" className="anim-fade absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/90 text-sm font-semibold text-text">
              <span aria-hidden className="size-6 animate-spin rounded-full border-[3px] border-line border-t-accent" />
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
    </li>
  );
}
