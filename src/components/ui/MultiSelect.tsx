"use client";

import { clsx } from "clsx";
import { Check, Search, X } from "lucide-react";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { SEARCH_MAX_LENGTH } from "@/lib/search";
import { inputClass } from "./Field";
import { useFloatingList } from "./useFloatingList";

export type Option = { id: string; label: string };

// Chọn nhiều mục từ danh sách lớn dần: gõ để tìm ở máy chủ, mục đã chọn hiện thành thẻ có nút bỏ.
export function MultiSelect({ label, value, onChange, search, placeholder = "Gõ để tìm…", error }: {
  label: string;
  value: Option[];
  onChange: (value: Option[]) => void;
  search: (q: string) => Promise<Option[]>;
  placeholder?: string;
  error?: string;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<Option[] | null>(null);
  const [anchorRef, listRef] = useFloatingList<HTMLDivElement, HTMLUListElement>(options !== null, 300);
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
            <li key={v.id} className="inline-flex items-center gap-1 rounded-full bg-accent-soft py-0.5 pr-1 pl-[9px] text-xs leading-[1.6] text-accent-ink">
              {v.label}
              <button type="button" aria-label={`Bỏ ${v.label}`} onClick={() => toggle(v)} className="grid size-6 place-items-center rounded-full text-accent-ink hover:bg-card">
                <X size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div ref={anchorRef} className="relative">
        <Search size={15} aria-hidden className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-text-3" />
        <input
          id={id}
          role="combobox"
          aria-expanded={options !== null}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={options?.[active] ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
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
          <ul ref={listRef} id={listId} role="listbox" aria-multiselectable className="fixed z-20 overflow-y-auto rounded-[10px] border border-line bg-card p-1.5 shadow-(--elev-sm)">
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
                  className={clsx("flex min-h-11 cursor-pointer items-center gap-2.5 rounded-md px-2.5 text-[13px]", i === active && "bg-panel")}
                >
                  <span aria-hidden className={clsx("grid size-[18px] flex-none place-items-center rounded-md border-[1.5px]", on ? "border-accent bg-accent text-on-accent" : "border-field-border bg-card")}>
                    {on && <Check size={12} strokeWidth={2.5} />}
                  </span>
                  {o.label}
                </li>
              );
            })}
            {!options.length && <li className="px-3 py-5 text-center text-[13px] text-text-3">Không tìm thấy</li>}
          </ul>
        )}
      </div>
      {error && (
        <span id={`${id}-error`} className="text-[12.5px] text-danger">
          {error}
        </span>
      )}
    </div>
  );
}
