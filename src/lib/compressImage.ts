import { extForMime } from "./imageKey";

export const MAX_EDGE = 1600;
export const TARGET_BYTES = 300 * 1024;
const QUALITIES = [0.82, 0.7, 0.58, 0.46];
const SCALES = [1, 0.75, 0.56, 0.42];

export function fitWithin(width: number, height: number, max = MAX_EDGE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

// Hạ chất lượng trước, chưa đủ thì thu nhỏ: chữ trên ảnh chụp màn hình vẫn phải đọc được khi hậu kiểm.
export async function shrink<T extends { size: number }>(encode: (scale: number, quality: number) => Promise<T>): Promise<T> {
  let best: T | null = null;
  for (const scale of SCALES) {
    for (const quality of QUALITIES) {
      const out = await encode(scale, quality);
      if (out.size <= TARGET_BYTES) return out;
      if (!best || out.size < best.size) best = out;
    }
  }
  return best!;
}

export function contentTypeOf(file: { type: string; name: string }): string | null {
  if (file.type) return extForMime(file.type) ? file.type : null;
  return /\.(heic|heif)$/i.test(file.name) ? "image/heic" : null;
}

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality));

// Trình duyệt mở được ảnh thì vẽ lại lên canvas (xoay theo EXIF, bỏ thông tin vị trí). Không mở được (HEIC trên Android) thì trả null.
export async function compressImage(file: File): Promise<Blob | null> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return null;
  try {
    const base = fitWithin(bitmap.width, bitmap.height);
    const canvas = document.createElement("canvas");
    const out = await shrink(async (scale, quality) => {
      canvas.width = Math.max(1, Math.round(base.width * scale));
      canvas.height = Math.max(1, Math.round(base.height * scale));
      canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      // Safari cũ không xuất được WebP, toBlob trả PNG: khi đó dùng JPEG.
      let blob = await toBlob(canvas, "image/webp", quality);
      if (blob?.type !== "image/webp") blob = await toBlob(canvas, "image/jpeg", quality);
      return blob ?? new Blob([]);
    });
    return out.size ? out : null;
  } finally {
    bitmap.close();
  }
}
