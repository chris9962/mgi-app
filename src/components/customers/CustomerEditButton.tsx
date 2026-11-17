"use client";

import { Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";
import { apiSend } from "@/lib/api";
import { CustomerEditForm } from "@/lib/customerForm";

export type CustomerEditDefaults = { id: string; fullName: string; className: string; parentPhone: string };

export function CustomerEditButton({ customer }: { customer: CustomerEditDefaults }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  function close() {
    setOpen(false);
    setErrors({});
    setFormError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const raw = Object.fromEntries(["fullName", "className", "parentPhone"].map((k) => [k, String(f.get(k) ?? "")]));
    const parsed = CustomerEditForm.safeParse(raw);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    setFormError("");
    setPending(true);
    const r = await apiSend("PATCH", `/api/admin/customers/${customer.id}`, raw);
    setPending(false);
    if (!r.ok) return r.field ? setErrors({ [r.field]: r.message }) : setFormError(r.message);
    close();
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil size={16} aria-hidden />
        Sửa thông tin
      </Button>
      {open && (
        <Dialog
          open
          title="Sửa thông tin"
          onClose={close}
          dismissible={!pending}
          footer={
            <>
              <Button variant="secondary" disabled={pending} onClick={close}>
                Huỷ
              </Button>
              <Button type="submit" form="customer-edit" disabled={pending}>
                Lưu
              </Button>
            </>
          }
        >
          <form id="customer-edit" onSubmit={submit} noValidate className="flex flex-col gap-3.5 pb-1">
            <div className="grid grid-cols-[2fr_1fr] items-start gap-3 narrow:grid-cols-1">
              <TextField name="fullName" label="Họ tên" defaultValue={customer.fullName} error={errors.fullName} data-autofocus />
              <TextField name="className" label="Lớp" defaultValue={customer.className} error={errors.className} />
            </div>
            <TextField name="parentPhone" label="SĐT phụ huynh" inputMode="numeric" defaultValue={customer.parentPhone} error={errors.parentPhone} />
            {formError && (
              <p role="alert" className="text-[12.5px] text-danger">
                {formError}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </>
  );
}
