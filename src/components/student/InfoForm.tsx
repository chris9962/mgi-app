"use client";

import { Check } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";
import { CONSENT_SECTIONS, CONSENT_TITLE } from "@/lib/consent";
import { CustomerForm, type CustomerSelfEditInput } from "@/lib/customerForm";
import { studentApi } from "@/lib/studentApi";
import { saveProfile } from "@/lib/studentDevice";
import type { StudentSchool } from "@/lib/studentState";
import { BankLogo, Bottom } from "./parts";

const EMPTY = { fullName: "", className: "", parentPhone: "" };
type Key = keyof typeof EMPTY;

// initial: học sinh quay lại sửa hồ sơ đã có; không có thì tạo hồ sơ mới.
export function InfoForm({ school, initial, onSaved }: { school: StudentSchool; initial?: CustomerSelfEditInput; onSaved: () => void }) {
  const [values, setValues] = useState(() => (initial ? { fullName: initial.fullName, className: initial.className, parentPhone: initial.parentPhone } : EMPTY));
  const [existing, setExisting] = useState<string[]>(initial?.existingBankIds ?? []);
  const [touched, setTouched] = useState<Set<Key>>(new Set());
  const [serverError, setServerError] = useState<{ field?: string; message: string } | null>(null);
  const [pending, setPending] = useState(false);
  // Hồ sơ đã có thì đã đồng ý lúc tạo: màn sửa không hỏi lại.
  const [consent, setConsent] = useState(Boolean(initial));
  const [termsOpen, setTermsOpen] = useState(false);
  const termsLinkId = useId();

  const raw = { ...values, schoolId: school.id, existingBankIds: existing, consent };
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
      <TextField label="Lớp" placeholder="11A3" autoComplete="off" autoCapitalize="characters" {...field("className")} />
      <TextField label="SĐT phụ huynh" type="tel" inputMode="numeric" autoComplete="off" {...field("parentPhone")} />
      {school.banks.length > 0 && (
        <fieldset className="flex flex-col gap-1.5">
          <legend className="mb-1.5 text-[13px] text-text-2">Ngân hàng đã có tài khoản</legend>
          {/* Mỗi ngân hàng một hàng: tên đầy đủ dài, xếp ba cột thì gãy bốn dòng. */}
          <div className="flex flex-col gap-2">
            {school.banks.map((b) => (
              <label key={b.id} className="group relative flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-field-border bg-card px-3 py-2 transition-colors duration-200 has-checked:border-accent has-checked:bg-accent-soft/40 has-checked:ring-1 has-checked:ring-accent has-focus-visible:outline-2 has-focus-visible:outline-accent">
                {/* Ô tick trong suốt phủ cả hàng: viền nổi và dấu tick bên phải báo đã chọn; bàn phím, trợ năng và test vẫn thấy ô tick. */}
                <input type="checkbox" className="absolute inset-0 cursor-pointer opacity-0" checked={existing.includes(b.id)} onChange={(e) => setExisting((list) => (e.target.checked ? [...list, b.id] : list.filter((id) => id !== b.id)))} />
                <span className="w-[72px] flex-none">
                  <BankLogo src={b.logoUrl} />
                </span>
                <span className="min-w-0 flex-1 text-[14px] leading-snug wrap-anywhere">{b.name}</span>
                <Check size={18} strokeWidth={3} aria-hidden className="flex-none text-accent-ink opacity-0 transition-opacity duration-200 group-has-checked:opacity-100" />
              </label>
            ))}
          </div>
          <span className="text-[13px] text-text-3">Chưa có thì bỏ trống</span>
        </fieldset>
      )}
      {!initial && (
        <div className="flex flex-wrap items-center gap-x-1.5">
          <Checkbox label="Đồng ý" name="consent" checked={consent} onChange={(e) => setConsent(e.target.checked)} aria-describedby={termsLinkId} />
          <button id={termsLinkId} type="button" onClick={() => setTermsOpen(true)} className="min-h-9 text-left text-[13.5px] text-accent-ink underline underline-offset-2">
            điều khoản xử lý dữ liệu cá nhân
          </button>
        </div>
      )}
      <Dialog
        open={termsOpen}
        title={CONSENT_TITLE}
        onClose={() => setTermsOpen(false)}
        footer={
          <Button
            type="button"
            onClick={() => {
              setConsent(true);
              setTermsOpen(false);
            }}
          >
            Đồng ý
          </Button>
        }
      >
        {CONSENT_SECTIONS.map((section) => (
          <section key={section.title}>
            <h3 className="text-[15px] font-semibold">{section.title}</h3>
            <ul className="list-disc pl-5 text-text-2">
              {section.lines.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          </section>
        ))}
      </Dialog>
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
