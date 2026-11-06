"use client";

import { useId, type SelectHTMLAttributes } from "react";
import { Field, inputClass } from "./Field";

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  label: string;
  error?: string;
  options: { value: string; label: string }[];
};

export function Select({ label, error, options, id, ...rest }: Props) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <Field id={selectId} label={label} error={error}>
      <select id={selectId} aria-invalid={error ? true : undefined} aria-describedby={error ? `${selectId}-error` : undefined} className={inputClass} {...rest}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}
