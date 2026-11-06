"use client";

import { ImageUp, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field, inputClass } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { ConfirmDialog } from "@/components/users/ConfirmDialog";
import { apiSend } from "@/lib/api";
import type { CustomerBankStatus } from "@/lib/studentState";

type Bank = { id: string; name: string; status: CustomerBankStatus; note: string; slots: { id: string; name: string }[] };

function ReplaceDialog({ bank, onClose }: { bank: Bank; onClose: () => void }) {
  const router = useRouter();
  const fileId = useId();
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    if (!(form.get("file") instanceof File) || !(form.get("file") as File).size) return setErrors({ file: "Chọn ảnh." });
    setErrors({});
    setPending(true);
    try {
      const res = await fetch(`/api/admin/customer-banks/${bank.id}/photos`, { method: "POST", body: form });
      const data = res.ok ? null : await res.json().catch(() => null);
      if (!res.ok) return setErrors({ [data?.field ?? "form"]: data?.message ?? "Không tải được ảnh lên. Thử lại." });
      onClose();
      router.refresh();
    } catch {
      setErrors({ form: "Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại." });
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog
      open
      title="Tải ảnh thay thế"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="replace-photo" disabled={pending}>
            {pending ? "Đang tải ảnh" : "Tải lên"}
          </Button>
        </>
      }
    >
      <form id="replace-photo" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Select label="Khung ảnh" name="slotId" options={bank.slots.map((s) => ({ value: s.id, label: s.name }))} error={errors.slotId} data-autofocus />
        <Field id={fileId} label="Ảnh" error={errors.file}>
          <input id={fileId} name="file" type="file" accept="image/jpeg,image/png,image/webp,image/heic" aria-invalid={errors.file ? true : undefined} aria-describedby={errors.file ? `${fileId}-error` : undefined} className={inputClass} />
        </Field>
        {errors.form && (
          <p role="alert" className="text-sm text-danger">
            {errors.form}
          </p>
        )}
      </form>
    </Dialog>
  );
}

function NoteDialog({ bank, onClose }: { bank: Bank; onClose: () => void }) {
  const router = useRouter();
  const id = useId();
  const [errors, setErrors] = useState<{ note?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const r = await apiSend("PUT", `/api/admin/customer-banks/${bank.id}/note`, { note: String(new FormData(event.currentTarget).get("note") ?? "") });
    setPending(false);
    // Mất mạng hay ngân hàng vừa bị bỏ giao không phải lỗi của ghi chú: báo ở dòng chung, không đánh dấu ô sai.
    if (!r.ok) return setErrors(r.field === "note" ? { note: r.message } : { form: r.message });
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      title="Ghi chú nội bộ"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="review-note" disabled={pending}>
            Lưu
          </Button>
        </>
      }
    >
      <form id="review-note" onSubmit={submit} noValidate className="flex flex-col gap-3">
        <Field id={id} label={`Ghi chú cho ${bank.name}`} error={errors.note}>
          <textarea id={id} name="note" rows={5} maxLength={1000} defaultValue={bank.note} data-autofocus aria-invalid={errors.note ? true : undefined} aria-describedby={errors.note ? `${id}-error` : undefined} className={inputClass} />
        </Field>
        {errors.form && (
          <p role="alert" className="text-sm text-danger">
            {errors.form}
          </p>
        )}
      </form>
    </Dialog>
  );
}

export function NoteButton({ bank }: { bank: Bank }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Sửa ghi chú ${bank.name}`} className="grid size-8 place-items-center rounded-lg text-text-2 hover:bg-surface hover:text-text">
        <Pencil size={15} aria-hidden />
      </button>
      {open && <NoteDialog bank={bank} onClose={() => setOpen(false)} />}
    </>
  );
}

export function ReviewActions({ bank }: { bank: Bank }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"passed" | "failed" | "replace" | null>(null);
  const open = bank.status === "pending" || bank.status === "failed";
  if (!open) return null;

  const mark = async (result: "passed" | "failed") => {
    const r = await apiSend("POST", `/api/admin/customer-banks/${bank.id}/review`, { result, expected: bank.status });
    if (!r.ok) return r.message;
    setDialog(null);
    router.refresh();
    return null;
  };

  return (
    <div className="flex flex-wrap justify-end gap-2 border-t border-line pt-4">
      <Button onClick={() => setDialog("passed")}>Đạt</Button>
      {bank.status === "pending" && (
        <Button variant="danger" onClick={() => setDialog("failed")}>
          Không đạt
        </Button>
      )}
      {bank.slots.length > 0 && (
        <Button variant="secondary" onClick={() => setDialog("replace")}>
          <ImageUp size={16} aria-hidden />
          Tải ảnh thay thế
        </Button>
      )}
      {dialog === "passed" && <ConfirmDialog open title="Đánh dấu Đạt" text={`Đánh dấu Đạt cho ${bank.name}?`} confirmLabel="Đạt" onClose={() => setDialog(null)} onConfirm={() => mark("passed")} />}
      {dialog === "failed" && (
        <ConfirmDialog open title="Đánh dấu Không đạt" text={`Đánh dấu Không đạt cho ${bank.name}?`} confirmLabel="Không đạt" danger onClose={() => setDialog(null)} onConfirm={() => mark("failed")} />
      )}
      {dialog === "replace" && <ReplaceDialog bank={bank} onClose={() => setDialog(null)} />}
    </div>
  );
}
