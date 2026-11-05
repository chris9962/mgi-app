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
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  function close() {
    setOpen(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const r = await apiSend("POST", `/api/admin/sms/${id}/resend`, { toPhone: String(new FormData(event.currentTarget).get("toPhone") ?? "") });
    setPending(false);
    if (!r.ok) return setError(r.message);
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
              <Button variant="secondary" onClick={close}>
                Huỷ
              </Button>
              <Button type="submit" form="sms-resend" disabled={pending}>
                Gửi lại
              </Button>
            </>
          }
        >
          <form id="sms-resend" onSubmit={submit} noValidate>
            <TextField name="toPhone" label="SĐT nhận" inputMode="numeric" defaultValue={toPhone} error={error} data-autofocus />
          </form>
        </Dialog>
      )}
    </>
  );
}
