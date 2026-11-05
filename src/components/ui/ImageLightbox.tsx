"use client";

import { clsx } from "clsx";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { ZoomableImage } from "./ZoomableImage";

// Chép từ mgst-app src/components/ui/ImageLightbox.tsx, bỏ nút tải ảnh: link S3 khác tên miền, bucket không mở CORS nên không tải về được.

export type LightboxPhoto = { src: string; alt: string; caption?: ReactNode };

const clamp = (value: number, last: number) => Math.min(Math.max(value, 0), Math.max(last, 0));

const tool = "grid size-11 place-items-center rounded-full bg-card text-text shadow-sm hover:text-accent-ink";
const zone =
  "absolute inset-y-0 flex w-[10%] min-w-11 items-center border-0 bg-transparent text-on-accent touch-pinch-zoom disabled:cursor-default [&:disabled_svg]:opacity-35 [&_svg]:box-content [&_svg]:rounded-full [&_svg]:bg-black/55 [&_svg]:p-1.5 focus-visible:outline-none [&:focus-visible_svg]:outline-2 [&:focus-visible_svg]:outline-offset-2 [&:focus-visible_svg]:outline-accent";

export function ImageLightbox({ photos, startIndex = 0, onClose }: { photos: readonly LightboxPhoto[]; startIndex?: number; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const last = photos.length - 1;
  const [index, setIndex] = useState(() => clamp(startIndex, last));
  const [zoomed, setZoomed] = useState(false);
  const at = clamp(index, last);
  const current = photos[at];
  const prevSrc = photos[at - 1]?.src;
  const nextSrc = photos[at + 1]?.src;

  // Nạp sẵn hai ảnh kề bên vào bộ đệm trình duyệt để bấm chuyển là hiện ngay.
  useEffect(() => {
    for (const src of [prevSrc, nextSrc]) {
      if (src) new window.Image().src = src;
    }
  }, [prevSrc, nextSrc]);

  // Bắt phím ở tầng tài liệu: bấm tới ảnh đầu hoặc cuối thì nút mờ đi, tiêu điểm rơi về body.
  useEffect(() => {
    if (photos.length < 2) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
      e.preventDefault();
      setIndex((i) => clamp(clamp(i, photos.length - 1) + (e.key === "ArrowRight" ? 1 : -1), photos.length - 1));
      setZoomed(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [photos.length]);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
  }, []);

  if (!current) return null;
  const many = photos.length > 1;
  const go = (step: number) => {
    setIndex(clamp(at + step, last));
    setZoomed(false);
  };

  return (
    <dialog
      ref={ref}
      aria-label={current.alt}
      // Chỉ nút Đóng mới đóng: lỡ bấm Esc lúc đang xem nhiều ảnh thì giữ nguyên.
      onCancel={(e) => e.preventDefault()}
      // Chrome tự đóng dialog ở lần Esc thứ hai liên tiếp; nghe close để nơi gọi biết.
      onClose={onClose}
      className="fixed inset-0 m-0 h-dvh max-h-none w-screen max-w-none overflow-hidden border-0 bg-transparent p-[env(safe-area-inset-top)_env(safe-area-inset-right)_env(safe-area-inset-bottom)_env(safe-area-inset-left)] text-text backdrop:bg-black/70 open:flex open:flex-col"
    >
      <div className="relative z-10 flex flex-none items-center justify-between gap-2 px-4 py-3">
        {many ? (
          <span aria-live="polite" className="rounded-full bg-card px-3.5 py-2 text-[13px] font-semibold tabular-nums shadow-sm">
            {at + 1} / {photos.length}
          </span>
        ) : (
          <span />
        )}
        <button type="button" className={tool} onClick={onClose} aria-label="Đóng">
          <X size={18} aria-hidden />
        </button>
      </div>
      <div className="relative flex min-h-0 flex-1 items-center justify-center px-3">
        <ZoomableImage key={current.src} src={current.src} alt={current.alt} onZoomedChange={setZoomed} />
        {many && !zoomed && (
          <>
            <button type="button" className={clsx(zone, "left-0 justify-start pl-3")} onClick={() => go(-1)} disabled={at === 0} aria-label="Ảnh trước">
              <ChevronLeft size={22} aria-hidden />
            </button>
            <button type="button" className={clsx(zone, "right-0 justify-end pr-3")} onClick={() => go(1)} disabled={at === last} aria-label="Ảnh sau">
              <ChevronRight size={22} aria-hidden />
            </button>
          </>
        )}
      </div>
      {current.caption && <div className="relative z-10 mx-3 mb-3 flex-none self-center rounded-xl bg-card px-4 py-2 text-center text-sm font-semibold">{current.caption}</div>}
    </dialog>
  );
}
