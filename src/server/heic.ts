import convert from "heic-convert";

// sharp treo khi đọc HEIC mã HEVC (libvips chỉ kèm bộ giải mã AV1), OpenCV của OCR không đọc được HEIC: đổi sang JPEG trước.
// Một ảnh 48 MP tốn khoảng 1,22 GB khi đổi (đo ở giai đoạn 7) mà container app trần 3 GB: đổi từng ảnh một, lượt khác chờ tới lượt.
let turn: Promise<unknown> = Promise.resolve();
export function heicToJpeg(bytes: Uint8Array, decode: typeof convert = convert): Promise<Uint8Array> {
  const mine = turn.then(async () => new Uint8Array(await decode({ buffer: bytes, format: "JPEG", quality: 0.92 })));
  turn = mine.catch(() => undefined);
  return mine;
}

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

// Máy Android 50 MP chụp 8160x6144, nhỉnh hơn 50 triệu điểm. Ảnh 64 MP tốn thêm khoảng 585 MB khi đổi, vừa trần 3 GB của app vì đổi từng ảnh một.
export const MAX_HEIC_PIXELS = 64_000_000;

// Thiếu hộp ispe thì không biết kích thước trước khi giải mã: coi như vượt trần.
export function heicFits(bytes: Uint8Array): boolean {
  const pixels = heicPixels(bytes);
  return pixels !== null && pixels <= MAX_HEIC_PIXELS;
}
