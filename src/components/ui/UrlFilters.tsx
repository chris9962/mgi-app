"use client";

import { useRouter } from "next/navigation";
import { useId, useOptimistic, useTransition } from "react";
import { FilterButton } from "./FilterButton";
import { inputClass } from "./Field";

export type FilterDef =
  // none: giá trị nghĩa là không lọc, mặc định chuỗi rỗng; trang mở sẵn một bộ lọc thì khai giá trị khác, ví dụ "all".
  | { kind: "choice"; id: string; label: string; key: string; options: { value: string; label: string }[]; none?: string }
  | { kind: "dates"; id: string; label: string; fromKey: string; toKey: string };

function Choices({ def, value, onPick }: { def: Extract<FilterDef, { kind: "choice" }>; value: string; onPick: (v: string) => void }) {
  const name = useId();
  return (
    <fieldset className="flex flex-col gap-1">
      <legend className="sr-only">{def.label}</legend>
      {def.options.map((o) => (
        <label key={o.value} className="flex min-h-10 cursor-pointer items-center gap-2.5 rounded-lg px-2 text-sm hover:bg-surface has-[:checked]:font-semibold">
          <input type="radio" name={name} checked={value === o.value} onChange={() => onPick(o.value)} className="size-4 accent-[var(--accent)]" />
          {o.label}
        </label>
      ))}
    </fieldset>
  );
}

function Dates({ from, to, onChange }: { from: string; to: string; onChange: (from: string, to: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-from`} className="text-[13px] text-text-2">
          Từ ngày
        </label>
        <input id={`${id}-from`} type="date" value={from} max={to || undefined} onChange={(e) => onChange(e.target.value, to)} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`${id}-to`} className="text-[13px] text-text-2">
          Đến ngày
        </label>
        <input id={`${id}-to`} type="date" value={to} min={from || undefined} onChange={(e) => onChange(from, e.target.value)} className={inputClass} />
      </div>
    </div>
  );
}

// Bộ lọc ghi lên URL rồi để trang máy chủ lọc lại; đổi lọc thì về trang 1.
export function UrlFilters({ path, params: committed, defs }: { path: string; params: Record<string, string>; defs: FilterDef[] }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  // Ô chọn đổi ngay khi bấm; trang máy chủ lọc xong thì giá trị trên URL thay vào.
  const [params, setParams] = useOptimistic(committed);
  const go = (patch: Record<string, string>) => {
    const merged = { ...params, ...patch };
    const next = Object.entries({ ...merged, page: "" }).filter(([, v]) => v !== "");
    startTransition(() => {
      setParams(merged);
      router.push(`${path}${next.length ? `?${new URLSearchParams(next)}` : ""}`);
    });
  };
  const cleared = Object.fromEntries(defs.flatMap((d) => (d.kind === "choice" ? [[d.key, d.none ?? ""]] : [[d.fromKey, ""], [d.toKey, ""]])));
  return (
    <FilterButton
      onClear={() => go(cleared)}
      sections={defs.map((d) =>
        d.kind === "choice"
          ? { id: d.id, label: d.label, count: (params[d.key] ?? "") !== (d.none ?? "") ? 1 : 0, content: <Choices def={d} value={params[d.key] ?? ""} onPick={(v) => go({ [d.key]: v })} /> }
          : {
              id: d.id,
              label: d.label,
              count: params[d.fromKey] || params[d.toKey] ? 1 : 0,
              content: <Dates from={params[d.fromKey] ?? ""} to={params[d.toKey] ?? ""} onChange={(f, t) => go({ [d.fromKey]: f, [d.toKey]: t })} />,
            },
      )}
    />
  );
}
