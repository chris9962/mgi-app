"use client";

import { clsx } from "clsx";
import { useId, type InputHTMLAttributes } from "react";
import { Field, inputClass } from "./Field";

type Props = InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string; hint?: string };

export function TextField({ label, error, hint, id, className, ...rest }: Props) {
  const auto = useId();
  const inputId = id ?? auto;
  return (
    <Field id={inputId} label={label} error={error} hint={hint}>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${inputId}-error` : undefined}
        className={clsx(inputClass, className)}
        {...rest}
      />
    </Field>
  );
}
