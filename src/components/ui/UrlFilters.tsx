"use client";

import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check } from "lucide-react";
import { useId, useOptimistic, useState, useTransition, type ComponentProps } from "react";
import { DateRangePicker } from "./DateRangePicker";
import { FilterButton } from "./FilterButton";
import { MultiSelect, type Option } from "./MultiSelect";

export type FilterDef =
  // none: giá trị nghĩa là không lọc, mặc định chuỗi rỗng; trang mở sẵn một bộ lọc thì khai giá trị khác, ví dụ "all".
  // multiple: chọn nhiều giá trị, ghép bằng dấu phẩy trên URL.
  | { kind: "choice"; id: string; label: string; key: string; options: { value: string; label: string }[]; none?: string; multiple?: boolean }
  | { kind: "dates"; id: string; label: string; fromKey: string; toKey: string }
  // search: danh sách lớn dần, tìm qua route url (tối đa 20 dòng); selected là nhãn của các id đang lọc, máy chủ đọc sẵn.
  | { kind: "search"; id: string; label: string; key: string; url: string; selected: Option[]; placeholder?: string };

const listOf = (v: string) => (v ? v.split(",") : []);

// Dòng chọn chép FilterChoices.module.css của mgst-app; giữ ô radio, checkbox thật để bàn phím và trình đọc màn hình dùng được, viền ô giữ --field-border để đạt 3:1.
const LIST = "-mx-[18px] -my-4 flex flex-col p-1.5";
const ROW =
  "flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px] text-text hover:bg-panel has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-1 has-[:focus-visible]:outline-accent";

function ChoiceBox(props: ComponentProps<"input">) {
  return (
    <span className="relative grid size-[18px] flex-none place-items-center">
      <input {...props} className="peer absolute inset-0 m-0 cursor-pointer appearance-none rounded-md border-[1.5px] border-field-border bg-card checked:border-accent checked:bg-accent focus-visible:outline-none" />
      <Check size={12} strokeWidth={2.5} aria-hidden className="pointer-events-none relative hidden text-on-accent peer-checked:block" />
    </span>
  );
}

function MultiChoices({ def, value, onPick }: { def: Extract<FilterDef, { kind: "choice" }>; value: string; onPick: (v: string) => void }) {
  const picked = listOf(value);
  return (
    <fieldset className={LIST}>
      <legend className="sr-only">{def.label}</legend>
      {def.options.map((o) => (
        <label key={o.value} className={ROW}>
          <ChoiceBox type="checkbox" checked={picked.includes(o.value)} onChange={(e) => onPick((e.target.checked ? [...picked, o.value] : picked.filter((v) => v !== o.value)).join(","))} />
          <span className="min-w-0 truncate">{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

function SearchChoices({ def, value, onPick }: { def: Extract<FilterDef, { kind: "search" }>; value: string; onPick: (v: string) => void }) {
  // Nhãn của mục vừa chọn giữ ở đây cho tới khi trang máy chủ trả selected mới.
  const [known, setKnown] = useState<Option[]>(def.selected);
  const label = (id: string) => def.selected.find((o) => o.id === id) ?? known.find((o) => o.id === id) ?? { id, label: id };
  return (
    <MultiSelect
      label={def.label}
      value={listOf(value).map(label)}
      onChange={(next) => {
        setKnown((k) => [...k, ...next.filter((o) => !k.some((x) => x.id === o.id))]);
        onPick(next.map((o) => o.id).join(","));
      }}
      search={async (q) => {
        const res = await fetch(`${def.url}?q=${encodeURIComponent(q)}`);
        return res.ok ? res.json() : [];
      }}
      placeholder={def.placeholder}
    />
  );
}

function Choices({ def, value, onPick }: { def: Extract<FilterDef, { kind: "choice" }>; value: string; onPick: (v: string) => void }) {
  const name = useId();
  return (
    <fieldset className={LIST}>
      <legend className="sr-only">{def.label}</legend>
      {def.options.map((o) => (
        <label key={o.value} className={ROW}>
          <ChoiceBox type="radio" name={name} checked={value === o.value} onChange={() => onPick(o.value)} />
          <span className="min-w-0 truncate">{o.label}</span>
        </label>
      ))}
    </fieldset>
  );
}

// Chuỗi ngày trên URL có thể sai (abc, 2026-02-30): ngày không có thật thì coi như chưa chọn.
function toDate(v: string): Date | undefined {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return undefined;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return format(d, "yyyy-MM-dd") === v ? d : undefined;
}

function Dates({ label, from, to, onChange }: { label: string; from: string; to: string; onChange: (from: string, to: string) => void }) {
  const start = toDate(from);
  const end = toDate(to);
  return (
    <DateRangePicker
      label={label}
      hideLabel
      value={start || end ? { from: start ?? end, to: end } : undefined}
      onChange={(r) => onChange(r?.from ? format(r.from, "yyyy-MM-dd") : "", r?.to ? format(r.to, "yyyy-MM-dd") : "")}
    />
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
  const cleared = Object.fromEntries(defs.flatMap((d) => (d.kind === "dates" ? [[d.fromKey, ""], [d.toKey, ""]] : [[d.key, d.kind === "choice" ? (d.none ?? "") : ""]])));
  return (
    <FilterButton
      onClear={() => go(cleared)}
      sections={defs.map((d) =>
        d.kind === "search" || (d.kind === "choice" && d.multiple)
          ? {
              id: d.id,
              label: d.label,
              count: listOf(params[d.key] ?? "").length,
              content: d.kind === "search" ? <SearchChoices def={d} value={params[d.key] ?? ""} onPick={(v) => go({ [d.key]: v })} /> : <MultiChoices def={d} value={params[d.key] ?? ""} onPick={(v) => go({ [d.key]: v })} />,
            }
          : d.kind === "choice"
          ? { id: d.id, label: d.label, count: (params[d.key] ?? "") !== (d.none ?? "") ? 1 : 0, content: <Choices def={d} value={params[d.key] ?? ""} onPick={(v) => go({ [d.key]: v })} /> }
          : {
              id: d.id,
              label: d.label,
              count: params[d.fromKey] || params[d.toKey] ? 1 : 0,
              content: <Dates label={d.label} from={params[d.fromKey] ?? ""} to={params[d.toKey] ?? ""} onChange={(f, t) => go({ [d.fromKey]: f, [d.toKey]: t })} />,
            },
      )}
    />
  );
}
