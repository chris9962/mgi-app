"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import { readQrPixels } from "@/lib/readQrImage";
import { schoolIdInLink } from "@/lib/studentDevice";

const NO_CAMERA = "Không mở được camera. Quét mã QR bằng camera của điện thoại.";

function CameraView({ onSchool }: { onSchool: (schoolId: string) => void }) {
  const video = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState("");
  const [hint, setHint] = useState("");
  const supported = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);

  const accept = useEffectEvent((text: string) => {
    const id = schoolIdInLink(text);
    if (id) onSchool(id);
    else setHint("Mã QR này không phải của trường.");
    return Boolean(id);
  });

  // Đồng bộ với camera của máy: mở luồng hình, dò QR vài lần mỗi giây, đóng hộp thoại thì tắt camera.
  useEffect(() => {
    const el = video.current;
    if (!el || !supported) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const canvas = document.createElement("canvas");
    const scan = async () => {
      if (stopped) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (ctx && el.videoWidth) {
        const scale = Math.min(1, 960 / Math.max(el.videoWidth, el.videoHeight));
        canvas.width = Math.round(el.videoWidth * scale);
        canvas.height = Math.round(el.videoHeight * scale);
        ctx.drawImage(el, 0, 0, canvas.width, canvas.height);
        const text = await readQrPixels(ctx.getImageData(0, 0, canvas.width, canvas.height)).catch(() => "");
        if (stopped || (text && accept(text))) return;
      }
      timer = setTimeout(scan, 300);
    };
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((t) => t.stop());
        stream = s;
        el.srcObject = s;
        await el.play().catch(() => undefined);
        scan();
      })
      .catch(() => !stopped && setError(NO_CAMERA));
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      el.srcObject = null;
    };
  }, [supported]);

  const message = supported ? error : NO_CAMERA;
  return (
    <div className="flex flex-col gap-3">
      {message ? (
        <p role="alert" className="text-sm text-danger">
          {message}
        </p>
      ) : (
        <video ref={video} aria-label="Camera" muted playsInline className="aspect-square w-full rounded-xl bg-black object-cover" />
      )}
      {hint && !message && (
        <p role="status" className="text-sm text-text-2">
          {hint}
        </p>
      )}
    </div>
  );
}

export function QrScanner({ onSchool, onClose }: { onSchool: (schoolId: string) => void; onClose: () => void }) {
  return (
    <Dialog open title="Quét mã QR" onClose={onClose} width={420}>
      <CameraView onSchool={onSchool} />
    </Dialog>
  );
}
