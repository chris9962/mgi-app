"use client";

import { clsx } from "clsx";
import { useId, useState, type KeyboardEvent } from "react";
import { plain } from "@/lib/text";
import { Field, inputClass } from "./Field";
import { useFloatingList } from "./useFloatingList";

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
  const [anchorRef, listRef] = useFloatingList<HTMLDivElement, HTMLUListElement>(open, 240);
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
      <div ref={anchorRef} className="relative">
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
          className={inputClass}
        />
        {open && (
          <ul ref={listRef} id={listId} role="listbox" className="fixed z-20 overflow-y-auto rounded-[10px] border border-line-strong bg-surface p-1.5 shadow-(--elev-lg)">
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
                className={clsx("cursor-pointer rounded-md px-2.5 py-2 text-[13.5px]", i === active && "bg-accent-soft")}
              >
                {o.label}
              </li>
            ))}
            {!shown.length && <li className="px-2.5 py-2 text-[13px] text-text-2">Không tìm thấy</li>}
          </ul>
        )}
      </div>
    </Field>
  );
}
