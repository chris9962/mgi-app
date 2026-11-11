"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { CustomerForm, type CustomerSelfEditInput } from "@/lib/customerForm";
import { studentApi } from "@/lib/studentApi";
import { saveProfile } from "@/lib/studentDevice";
import type { StudentSchool } from "@/lib/studentState";
import { BankLogo, Bottom } from "./parts";

const EMPTY = { fullName: "", className: "", phone: "", parentName: "", parentPhone: "" };
type Key = keyof typeof EMPTY;

// initial: học sinh quay lại sửa hồ sơ đã có; không có thì tạo hồ sơ mới.
export function InfoForm({ school, initial, onSaved }: { school: StudentSchool; initial?: CustomerSelfEditInput; onSaved: () => void }) {
  const [values, setValues] = useState(() => (initial ? { fullName: initial.fullName, className: initial.className, phone: initial.phone, parentName: initial.parentName, parentPhone: initial.parentPhone } : EMPTY));
  const [existing, setExisting] = useState<string[]>(initial?.existingBankIds ?? []);
  const [touched, setTouched] = useState<Set<Key>>(new Set());
  const [serverError, setServerError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, setPending] = useState(false);

  const raw = { ...values, schoolId: school.id, existingBankIds: existing };
  const parsed = CustomerForm.safeParse(raw);
  const errors = new Map<string, string>();
  if (!parsed.success) for (const issue of parsed.error.issues) if (!errors.has(String(issue.path[0]))) errors.set(String(issue.path[0]), issue.message);
  const errorOf = (k: Key) => (touched.has(k) ? errors.get(k) : undefined) ?? (serverError?.field === k ? serverError.message : undefined);

  const field = (k: Key) => ({
    name: k,
    value: values[k],
    error: errorOf(k),
    onChange: (e: { target: { value: string } }) => {
      setValues((v) => ({ ...v, [k]: e.target.value }));
      if (serverError?.field === k) setServerError(null);
    },
    onBlur: () => setTouched((t) => new Set(t).add(k)),
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!parsed.success || pending) return;
    setPending(true);
    if (initial) {
      const saved = await studentApi("PATCH", "/api/customers/me", { ...values, existingBankIds: existing });
      // 409: hồ sơ đã đổi ở máy chủ (tab khác đã chọn ngân hàng, trường vừa đóng): tải lại để màn khớp máy chủ.
      if (saved.ok || saved.status === 409) return onSaved();
      setPending(false);
      return setServerError({ field: saved.field, message: saved.message });
    }
    const r = await studentApi<{ id: string; token: string }>("POST", "/api/customers", raw);
    if (!r.ok) {
      setPending(false);
      return setServerError({ field: r.field, message: r.message });
    }
    saveProfile(localStorage, r.data.id, r.data.token);
    onSaved();
  }

  const formError = serverError && !(serverError.field && serverError.field in EMPTY) ? serverError.message : "";

  return (
    <form onSubmit={submit} noValidate className="flex flex-1 flex-col gap-4">
      <TextField label="Họ và tên" autoComplete="name" {...field("fullName")} />
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <TextField label="Lớp" placeholder="11A3" autoComplete="off" autoCapitalize="characters" {...field("className")} />
        </div>
        <div className="min-w-0 flex-[2]">
          <TextField label="SĐT" type="tel" inputMode="numeric" autoComplete="tel" {...field("phone")} />
        </div>
      </div>
      <h2 className="mt-1 text-[15px] font-semibold">Phụ huynh</h2>
      <TextField label="Họ và tên phụ huynh" autoComplete="off" {...field("parentName")} />
      <TextField label="SĐT phụ huynh" type="tel" inputMode="numeric" autoComplete="off" {...field("parentPhone")} />
      {school.banks.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] text-text-2">Ngân hàng đã có tài khoản</legend>
          <div className="grid grid-cols-3 gap-2">
            {school.banks.map((b) => (
              <label key={b.id} className="flex min-w-0 cursor-pointer flex-col gap-1.5 rounded-xl border border-field-border bg-card p-1.5 transition-colors duration-200 has-[:checked]:border-accent has-[:checked]:bg-accent-soft/40">
                <BankLogo src={b.logoUrl} />
                <span className="flex items-center gap-1.5 text-[13px] leading-tight">
                  <input
                    type="checkbox"
                    className="size-[18px] shrink-0 accent-[var(--accent)]"
                    checked={existing.includes(b.id)}
                    onChange={(e) => setExisting((list) => (e.target.checked ? [...list, b.id] : list.filter((id) => id !== b.id)))}
                  />
                  <span className="min-w-0 wrap-anywhere">{b.name}</span>
                </span>
              </label>
            ))}
          </div>
          <span className="text-[13px] text-text-3">Chưa có thì bỏ trống</span>
        </fieldset>
      )}
      {formError && (
        <p role="alert" className="text-sm text-danger">
          {formError}
        </p>
      )}
      <Bottom sticky>
        <Button type="submit" large block disabled={!parsed.success || pending}>
          Tiếp tục
        </Button>
      </Bottom>
    </form>
  );
}
