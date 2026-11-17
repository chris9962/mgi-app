"use client";

import { Gift } from "lucide-react";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { GIFT_AMOUNT, GiftForm } from "@/lib/giftForm";
import { studentApi } from "@/lib/studentApi";
import type { StudentGift } from "@/lib/studentState";

export const GIFT_LABEL = `${GIFT_AMOUNT.toLocaleString("vi-VN")} đồng`;

// Mở từ ngân hàng thứ hai được tặng 20.000 đồng: học sinh khai tài khoản nhận, chuyển vào một ngân hàng đã gửi kiểm tra.
export function GiftDialog({ gift, fullName, onClose, onSaved }: { gift: StudentGift; fullName: string; onClose: () => void; onSaved: () => Promise<void> }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const raw = { bankId: f.get("bankId"), accountNumber: f.get("accountNumber"), accountName: f.get("accountName") };
    const parsed = GiftForm.safeParse(raw);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    setFormError("");
    setPending(true);
    const r = await studentApi("POST", "/api/customers/me/gift", raw);
    if (!r.ok) {
      setPending(false);
      // Đã nhập ở tab khác: tải lại để màn khớp máy chủ.
      if (r.status === 409) {
        await onSaved();
        return onClose();
      }
      return r.field ? setErrors({ [r.field]: r.message }) : setFormError(r.message);
    }
    await onSaved();
    onClose();
  }

  return (
    <Dialog
      open
      title={`Nhận ${GIFT_LABEL}`}
      onClose={onClose}
      dismissible={!pending}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Để sau
          </Button>
          <Button type="submit" form="gift-form" disabled={pending}>
            Nhận quà
          </Button>
        </>
      }
    >
      <p className="flex items-center gap-3 rounded-2xl bg-accent-soft/60 px-4 py-3 text-[15px] leading-snug font-medium text-accent-ink">
        <Gift size={22} aria-hidden className="flex-none" />
        Mở từ ngân hàng thứ hai được tặng {GIFT_LABEL}.
      </p>
      <form id="gift-form" onSubmit={submit} noValidate className="flex flex-col gap-3.5 pb-1">
        <Select label="Chuyển vào tài khoản ngân hàng" name="bankId" options={gift.banks.map((b) => ({ value: b.id, label: b.name }))} error={errors.bankId} data-autofocus />
        <TextField name="accountNumber" label="Số tài khoản" inputMode="numeric" autoComplete="off" error={errors.accountNumber} />
        <TextField name="accountName" label="Tên chủ tài khoản" defaultValue={fullName} autoComplete="off" error={errors.accountName} />
        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
      </form>
    </Dialog>
  );
}
