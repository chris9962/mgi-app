import convert from "heic-convert";

// sharp treo khi đọc HEIC mã HEVC (libvips chỉ kèm bộ giải mã AV1), OpenCV của OCR không đọc được HEIC: đổi sang JPEG trước.
export const heicToJpeg = async (bytes: Uint8Array): Promise<Uint8Array> => new Uint8Array(await convert({ buffer: bytes, format: "JPEG", quality: 0.92 }));

// heic-convert giải mã cả ảnh trong JavaScript rồi mới biết kích thước: đọc hộp ispe (20 byte: cỡ, "ispe", version, rộng, cao) trước để chặn ảnh quá lớn.
// Ảnh lưới của iPhone có một hộp cho cả ảnh và một hộp cho mỗi ô, nên lấy hộp lớn nhất.
export function heicPixels(bytes: Uint8Array): number | null {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let most: number | null = null;
  for (let i = 4; i + 16 <= bytes.length; i += 1) {
    if (bytes[i] !== 0x69 || bytes[i + 1] !== 0x73 || bytes[i + 2] !== 0x70 || bytes[i + 3] !== 0x65 || view.getUint32(i - 4) !== 20) continue;
    const pixels = view.getUint32(i + 8) * view.getUint32(i + 12);
    if (most === null || pixels > most) most = pixels;
  }
  return most;
}
