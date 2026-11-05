import QRCode from "qrcode";

const isLink = (v: string) => /^https?:\/\/\S+$/i.test(v);

// Tính ma trận QR ngay lúc render rồi vẽ SVG: QR là giá trị suy ra từ link, không cần effect.
export function QrPreview({ value, label }: { value: string; label: string }) {
  if (!isLink(value)) {
    return <span className="grid size-[84px] flex-none place-items-center rounded-md border border-dashed border-line text-center text-xs text-text-3">Chưa có link</span>;
  }
  const { modules } = QRCode.create(value, { errorCorrectionLevel: "M" });
  const n = modules.size;
  let path = "";
  for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) if (modules.get(y, x)) path += `M${x + 1} ${y + 1}h1v1h-1z`;
  return (
    <svg role="img" aria-label={label} viewBox={`0 0 ${n + 2} ${n + 2}`} width={84} height={84} shapeRendering="crispEdges" className="flex-none rounded-md border border-line bg-white">
      <path d={path} fill="#000" />
    </svg>
  );
}
