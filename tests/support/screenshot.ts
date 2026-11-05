import sharp from "sharp";

// Ảnh chụp màn hình giả: nền chuyển màu và 40 dòng chữ, nén được như ảnh thật, khác ảnh nhiễu không bao giờ lọt trần.
export async function screenshot(width: number, height: number, format: "png" | "webp", quality = 90): Promise<Uint8Array<ArrayBuffer>> {
  const lines = Array.from({ length: 40 }, (_, i) => `<text x="40" y="${80 + i * 90}" font-family="Arial" font-size="56" fill="#${((i * 2654435761) >>> 8).toString(16).padStart(6, "0").slice(0, 6)}">Dòng ${i} TRẦN MINH ANH AT105 ${i * 7919}</text>`).join("");
  const svg = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3e7d3"/><stop offset="1" stop-color="#3a6ea5"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/>${lines}</svg>`);
  const img = sharp(svg);
  return new Uint8Array(format === "png" ? await img.png().toBuffer() : await img.webp({ quality }).toBuffer());
}

// Chữ ký đầu file đúng mà phần sau là rác: trình giải mã nào cũng không mở được.
export const broken = (head: number[]): Uint8Array => new Uint8Array([...head, ...Array.from({ length: 4000 }, (_, i) => (i * 31) % 251)]);
export const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
export const JPEG_HEAD = [0xff, 0xd8, 0xff, 0xe0];
export const HEIC_HEAD = [0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63];
