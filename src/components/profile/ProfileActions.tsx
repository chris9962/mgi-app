"use client";

import { ChevronRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";
import { apiSend } from "@/lib/api";
import { InfoForm, PasswordForm } from "@/lib/profileForm";

const rowClass = "flex min-h-12 w-full items-center justify-between px-4 text-left text-sm hover:bg-surface";

function useFormState() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  return { errors, setErrors, formError, setFormError, pending, setPending };
}

export function EditInfoRow({ fullName, phone }: { fullName: string; phone: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const s = useFormState();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const parsed = InfoForm.safeParse({ fullName: f.get("fullName"), phone: f.get("phone") });
    if (!parsed.success) return s.setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    s.setErrors({});
    s.setPending(true);
    const r = await apiSend("PATCH", "/api/admin/profile", parsed.data);
    s.setPending(false);
    if (!r.ok) return s.setFormError(r.message);
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <button type="button" className={`${rowClass} font-semibold text-accent`} onClick={() => setOpen(true)}>
        Sửa thông tin
        <ChevronRight size={16} aria-hidden />
      </button>
      {open && (
        <Dialog
          open
          title="Sửa thông tin"
          onClose={() => setOpen(false)}
          width={440}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Huỷ
              </Button>
              <Button type="submit" form="info-form" disabled={s.pending}>
                Lưu
              </Button>
            </>
          }
        >
          <form id="info-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
            <TextField name="fullName" label="Họ tên" defaultValue={fullName} error={s.errors.fullName} autoFocus />
            <TextField name="phone" label="Số điện thoại" inputMode="numeric" defaultValue={phone} error={s.errors.phone} />
            {s.formError && (
              <p role="alert" className="text-sm text-danger">
                {s.formError}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </>
  );
}

export function ChangePasswordRow() {
  const [open, setOpen] = useState(false);
  const [done, setDone] = useState(false);
  const s = useFormState();

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const parsed = PasswordForm.safeParse({
      currentPassword: f.get("currentPassword"),
      newPassword: f.get("newPassword"),
      confirmPassword: f.get("confirmPassword"),
    });
    if (!parsed.success) return s.setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    s.setErrors({});
    s.setFormError("");
    s.setPending(true);
    const r = await apiSend("POST", "/api/admin/profile/password", parsed.data);
    s.setPending(false);
    if (!r.ok) return r.field ? s.setErrors({ [r.field]: r.message }) : s.setFormError(r.message);
    setOpen(false);
    setDone(true);
  }

  return (
    <>
      <button type="button" className={rowClass} onClick={() => setOpen(true)}>
        Đổi mật khẩu
        <span className="flex items-center gap-2 text-text-3">
          {done && <span className="text-ok-ink">Đã đổi</span>}
          <ChevronRight size={16} aria-hidden />
        </span>
      </button>
      {open && (
        <Dialog
          open
          title="Đổi mật khẩu"
          onClose={() => setOpen(false)}
          width={440}
          footer={
            <>
              <Button variant="secondary" onClick={() => setOpen(false)}>
                Huỷ
              </Button>
              <Button type="submit" form="password-form" disabled={s.pending}>
                Đổi mật khẩu
              </Button>
            </>
          }
        >
          <form id="password-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
            <PasswordField name="currentPassword" label="Mật khẩu hiện tại" placeholder="Mật khẩu đang dùng" autoComplete="current-password" error={s.errors.currentPassword} />
            <PasswordField name="newPassword" label="Mật khẩu mới" placeholder="Mật khẩu muốn đổi sang" autoComplete="new-password" error={s.errors.newPassword} />
            <PasswordField name="confirmPassword" label="Nhập lại mật khẩu mới" placeholder="Gõ lại mật khẩu mới" autoComplete="new-password" error={s.errors.confirmPassword} />
            {s.formError && (
              <p role="alert" className="text-sm text-danger">
                {s.formError}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </>
  );
}
