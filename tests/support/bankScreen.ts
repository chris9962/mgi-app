import sharp from "sharp";

const escape = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Ảnh giống màn mở tài khoản của app ngân hàng: chữ thật vẽ bằng font hệ thống, để OCR thật đọc như ảnh học sinh chụp.
export async function bankScreen(values: { name: string; code: string }, format: "webp" | "png" = "webp"): Promise<Uint8Array> {
  const rows: [string, number, string][] = [
    ["Mở tài khoản thành công", 44, "#0a7d33"],
    ["Họ và tên", 30, "#666666"],
    [values.name, 46, "#111111"],
    ["Số tài khoản", 30, "#666666"],
    ["1000 5476 110", 42, "#111111"],
    ["Mã giới thiệu", 30, "#666666"],
    [values.code, 46, "#111111"],
    ["Ngày mở 05/11/2026", 30, "#666666"],
  ];
  const text = rows.map(([t, size, color], i) => `<text x="60" y="${220 + i * 110}" font-family="Arial" font-size="${size}" fill="${color}">${escape(t)}</text>`).join("");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1600"><rect width="100%" height="100%" fill="#ffffff"/><rect width="100%" height="120" fill="#1f6feb"/><text x="60" y="80" font-family="Arial" font-size="40" fill="#ffffff">Ngân hàng</text>${text}</svg>`;
  const img = sharp(Buffer.from(svg));
  return new Uint8Array(format === "webp" ? await img.webp({ quality: 85 }).toBuffer() : await img.png().toBuffer());
}
