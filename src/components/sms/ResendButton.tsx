"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { TextField } from "@/components/ui/TextField";
import { apiSend } from "@/lib/api";

export function ResendButton({ id, fullName, toPhone }: { id: string; fullName: string; toPhone: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<{ toPhone?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  function close() {
    // Như dismissible={!pending} của mgst-app: tin đã gửi lại thì đóng hộp không huỷ được.
    if (pending) return;
    setOpen(false);
    setErrors({});
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const r = await apiSend("POST", `/api/admin/sms/${id}/resend`, { toPhone: String(new FormData(event.currentTarget).get("toPhone") ?? "") });
    setPending(false);
    // Tab khác vừa gửi lại hay mất mạng không phải lỗi của SĐT: báo ở dòng chung, không đánh dấu ô sai.
    if (!r.ok) return setErrors(r.field === "toPhone" ? { toPhone: r.message } : { form: r.message });
    close();
    router.refresh();
  }

  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)} aria-label={`Gửi lại tin cho ${fullName}`}>
        Gửi lại
      </Button>
      {open && (
        <Dialog
          open
          title="Gửi lại tin SMS"
          onClose={close}
          width={420}
          footer={
            <>
              <Button variant="secondary" disabled={pending} onClick={close}>
                Huỷ
              </Button>
              <Button type="submit" form="sms-resend" disabled={pending}>
                Gửi lại
              </Button>
            </>
          }
        >
          <form id="sms-resend" onSubmit={submit} noValidate className="flex flex-col gap-3">
            <TextField name="toPhone" label="SĐT nhận" inputMode="numeric" defaultValue={toPhone} error={errors.toPhone} data-autofocus />
            {errors.form && (
              <p role="alert" className="text-sm text-danger">
                {errors.form}
              </p>
            )}
          </form>
        </Dialog>
      )}
    </>
  );
}
