import QRCode from "qrcode";

const isLink = (v: string) => /^https?:\/\/\S+$/i.test(v);
const QR_MAX_BYTES = 2331;
const empty = (text: string) => <span className="grid size-[84px] flex-none place-items-center rounded-md border border-dashed border-line text-center text-xs text-text-3">{text}</span>;

// Tính ma trận QR ngay lúc render rồi vẽ SVG: QR là giá trị suy ra từ link, không cần effect.
export function QrPreview({ value, label, size = 84 }: { value: string; label: string; size?: number }) {
  if (!isLink(value)) return empty("Chưa có link");
  // Link quá sức chứa của QR làm QRCode.create ném lỗi giữa lúc render, vỡ cả trang đang gõ link.
  if (new TextEncoder().encode(value).length > QR_MAX_BYTES) return empty("Link quá dài");
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = modules.size;
  let path = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(y, x)) path += `M${x + 1} ${y + 1}h1v1h-1z`;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${n + 2} ${n + 2}`} width={size} height={size} shapeRendering="crispEdges" className="flex-none rounded-md border border-line bg-white">
      <path d={path} fill="#000" />
    </svg>
  );
}
