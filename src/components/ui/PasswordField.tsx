"use client";

import { Eye, EyeOff } from "lucide-react";
import { useId, useState, type InputHTMLAttributes } from "react";
import { Field, inputClass } from "./Field";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type"> & { label: string; error?: string };

export function PasswordField({ label, error, id, ...rest }: Props) {
  const auto = useId();
  const inputId = id ?? auto;
  const [shown, setShown] = useState(false);
  return (
    <Field id={inputId} label={label} error={error}>
      <div className="relative">
        <input
          id={inputId}
          type={shown ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${inputId}-error` : undefined}
          className={`${inputClass} pr-11`}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          className="absolute inset-y-0 right-0 grid w-10 place-items-center text-text-3 hover:text-text"
        >
          {shown ? <EyeOff size={16} aria-hidden /> : <Eye size={16} aria-hidden />}
        </button>
      </div>
    </Field>
  );
}
