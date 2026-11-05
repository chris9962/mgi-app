import { StatusTag } from "@/components/ui/StatusTag";
import { OPS_RESOURCE_PERCENT } from "@/lib/ops";

export function ResourceCell({ label, percent, value, details }: { label: string; percent: number | null; value?: string; details: string[] }) {
  const high = percent !== null && percent >= OPS_RESOURCE_PERCENT;
  return (
    <div className="grid content-start gap-1.5 rounded-xl border border-line bg-card px-3.5 py-3">
      <div className="flex min-h-6 items-center gap-2">
        <span className="text-[13px] text-text-2">{label}</span>
        {high && <StatusTag tone="warn">Vượt {OPS_RESOURCE_PERCENT}%</StatusTag>}
      </div>
      <b className="text-[26px] leading-tight font-semibold tabular-nums">{percent === null ? value : `${percent}%`}</b>
      {percent !== null && (
        <span role="img" aria-label={`${label}: đã dùng ${percent} phần trăm`} className="block h-1.5 overflow-hidden rounded-full bg-surface">
          <i className="block h-full rounded-full bg-accent" style={{ width: `${percent}%` }} />
        </span>
      )}
      {details.map((d) => (
        <span key={d} className="text-[12.5px] text-text-3 tabular-nums">
          {d}
        </span>
      ))}
    </div>
  );
}
