import sharp from "sharp";
import { heicFits, heicPixels, heicToJpeg, MAX_HEIC_PIXELS } from "./heic";

// Chép từ mgst-app: chốt cuối sau bước nén ở điện thoại, vì Safari cũ không xuất được WebP và không trình duyệt nào ngoài Safari đọc được HEIC.
const MAX_EDGE = 1600;
const MAX_BYTES = 300 * 1024;
// Dừng ở bậc đầu tiên lọt trần: ảnh nền phẳng đạt ngay ở 85, ảnh nhiều chi tiết mới phải xuống thấp hơn.
const QUALITY_STEPS = [85, 80, 75, 70];
// Khác mgst-app: route nộp ảnh mở cho học sinh không đăng nhập, ảnh vài chục KB khai 100 MP làm app tốn hơn 1 GB RAM và đứng vài giây.
const MAX_INPUT_PIXELS = 100_000_000;

// Trả null khi ảnh đã là WebP trong trần hoặc không giải mã được: nơi gọi giữ file gốc, ảnh xem không được vẫn hơn mất ảnh.
export async function toWebpOnServer(bytes: Uint8Array, ext: string): Promise<Uint8Array | null> {
  try {
    if (ext === "heic" && !heicFits(bytes)) throw new Error(`HEIC ${heicPixels(bytes) ?? "không rõ"} điểm ảnh, vượt trần ${MAX_HEIC_PIXELS}.`);
    const src = Buffer.from(ext === "heic" ? await heicToJpeg(bytes) : bytes);
    // failOn none: JPEG thiếu vài byte cuối vẫn dựng được phần đã có thay vì mất cả ảnh.
    const meta = await sharp(src, { failOn: "none", limitInputPixels: MAX_INPUT_PIXELS }).metadata();
    if (ext === "webp" && Math.max(meta.width ?? 0, meta.height ?? 0) <= MAX_EDGE && bytes.length <= MAX_BYTES) return null;
    let out: Buffer | null = null;
    for (const quality of QUALITY_STEPS) {
      out = await sharp(src, { failOn: "none", limitInputPixels: MAX_INPUT_PIXELS }).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true }).webp({ quality }).toBuffer();
      if (out.length <= MAX_BYTES) break;
    }
    return out ? new Uint8Array(out) : null;
  } catch (e) {
    console.error("[storage] không đổi được ảnh sang WebP:", e);
    return null;
  }
}
