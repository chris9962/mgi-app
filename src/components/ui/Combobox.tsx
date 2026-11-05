"use client";

import { clsx } from "clsx";
import { ChevronDown } from "lucide-react";
import { useId, useState, type KeyboardEvent } from "react";
import { plain } from "@/lib/text";
import { Field, inputClass } from "./Field";

type Option = { value: string; label: string };

// Ô chọn có tìm theo chữ gõ, không phân biệt dấu. Dùng cho danh sách vài trăm dòng như xã/phường của một tỉnh.
export function Combobox({ label, name, options, value, onChange, placeholder, error, disabled }: {
  label: string;
  name: string;
  options: Option[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  error?: string;
  disabled?: boolean;
}) {
  const id = useId();
  const listId = `${id}-list`;
  const selected = options.find((o) => o.value === value);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const open = query !== null;
  const shown = open ? options.filter((o) => plain(o.label).includes(plain(query))).slice(0, 50) : [];

  function choose(o: Option) {
    onChange(o.value);
    setQuery(null);
  }

  function onKey(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open) setQuery("");
      setActive((a) => Math.min(a + 1, Math.max(shown.length - 1, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && open && shown[active]) {
      e.preventDefault();
      choose(shown[active]);
    } else if (e.key === "Escape" && open) {
      e.preventDefault();
      setQuery(null);
    }
  }

  return (
    <Field id={id} label={label} error={error}>
      <div className="relative">
        <input type="hidden" name={name} value={value} />
        <input
          id={id}
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={open && shown[active] ? `${listId}-${active}` : undefined}
          aria-invalid={error ? true : undefined}
          autoComplete="off"
          disabled={disabled}
          placeholder={placeholder}
          value={open ? query : (selected?.label ?? "")}
          onFocus={() => setQuery("")}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
          }}
          onBlur={() => setQuery(null)}
          onKeyDown={onKey}
          className={clsx(inputClass, "pr-9 disabled:bg-surface")}
        />
        <ChevronDown size={16} aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-text-3" />
        {open && (
          <ul id={listId} role="listbox" className="absolute z-20 mt-1 max-h-64 w-full overflow-auto rounded-[10px] border border-line bg-card p-1 shadow-lg">
            {shown.map((o, i) => (
              <li
                key={o.value}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={o.value === value}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(o);
                }}
                onMouseEnter={() => setActive(i)}
                className={clsx("cursor-pointer rounded-md px-3 py-2 text-sm", i === active && "bg-surface", o.value === value && "font-semibold")}
              >
                {o.label}
              </li>
            ))}
            {!shown.length && <li className="px-3 py-2 text-sm text-text-3">Không có kết quả</li>}
          </ul>
        )}
      </div>
    </Field>
  );
}
