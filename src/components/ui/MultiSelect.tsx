"use client";

import { clsx } from "clsx";
import { Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { SEARCH_MAX_LENGTH } from "@/lib/search";
import { inputClass } from "./Field";

export type Option = { id: string; label: string };

// Chọn nhiều mục từ danh sách lớn dần: gõ để tìm ở máy chủ, mục đã chọn hiện thành thẻ có nút bỏ.
export function MultiSelect({ label, value, onChange, search, placeholder = "Gõ để tìm…" }: {
  label: string;
  value: Option[];
  onChange: (value: Option[]) => void;
  search: (q: string) => Promise<Option[]>;
  placeholder?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[] | null>(null);
  const [active, setActive] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const latest = useRef("");
  const focused = useRef(false);

  useEffect(() => () => clearTimeout(timer.current), []);

  function load(q: string) {
    latest.current = q;
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const rows = await search(q).catch(() => []);
      // Kết quả về sau khi ô đã mất focus thì bỏ, không mở lại danh sách đè lên hộp thoại.
      if (latest.current === q && focused.current) {
        setOptions(rows);
        setActive(0);
      }
    }, 200);
  }

  function toggle(o: Option) {
    onChange(value.some((v) => v.id === o.id) ? value.filter((v) => v.id !== o.id) : [...value, o]);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    // Enter trong ô tìm không bao giờ gửi form, kể cả khi kết quả chưa về.
    if (e.key === "Enter") e.preventDefault();
    if (!options) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, Math.max(options.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && options[active]) {
      toggle(options[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      setOptions(null);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] text-text-2">
        {label}
      </label>
      {value.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label={`${label} đã chọn`}>
          {value.map((v) => (
            <li key={v.id} className="inline-flex items-center gap-1 rounded-full border border-line bg-surface py-0.5 pr-1 pl-2.5 text-[13px]">
              {v.label}
              <button type="button" aria-label={`Bỏ ${v.label}`} onClick={() => toggle(v)} className="grid size-6 place-items-center rounded-full text-text-2 hover:bg-card">
                <X size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="relative">
        <Search size={15} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-3" />
        <input
          id={id}
          role="combobox"
          aria-expanded={options !== null}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={options?.[active] ? `${listId}-${active}` : undefined}
          autoComplete="off"
          placeholder={placeholder}
          maxLength={SEARCH_MAX_LENGTH}
          value={query}
          onFocus={() => {
            focused.current = true;
            load(query);
          }}
          onChange={(e) => {
            setQuery(e.target.value);
            load(e.target.value);
          }}
          onBlur={() => {
            focused.current = false;
            setOptions(null);
          }}
          onKeyDown={onKey}
          className={clsx(inputClass, "pl-9")}
        />
        {options && (
          <ul id={listId} role="listbox" aria-multiselectable className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-[10px] border border-line bg-card p-1 shadow-lg">
            {options.map((o, i) => {
              const on = value.some((v) => v.id === o.id);
              return (
                <li
                  key={o.id}
                  id={`${listId}-${i}`}
                  role="option"
                  aria-selected={on}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    toggle(o);
                  }}
                  onMouseEnter={() => setActive(i)}
                  className={clsx("flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-2 text-sm", i === active && "bg-surface")}
                >
                  <span aria-hidden className={clsx("grid size-[18px] flex-none place-items-center rounded border text-[11px] font-bold", on ? "border-accent bg-accent text-on-accent" : "border-field-border")}>
                    {on ? "✓" : ""}
                  </span>
                  {o.label}
                </li>
              );
            })}
            {!options.length && <li className="px-3 py-2 text-sm text-text-3">Không có kết quả</li>}
          </ul>
        )}
      </div>
    </div>
  );
}
