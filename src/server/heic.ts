import convert from "heic-convert";

// sharp treo khi đọc HEIC mã HEVC (libvips chỉ kèm bộ giải mã AV1), OpenCV của OCR không đọc được HEIC: đổi sang JPEG trước.
export const heicToJpeg = async (bytes: Uint8Array): Promise<Uint8Array> => new Uint8Array(await convert({ buffer: bytes, format: "JPEG", quality: 0.92 }));
