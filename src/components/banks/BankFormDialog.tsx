"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { MultiSelect, type Option } from "@/components/ui/MultiSelect";
import { TextField } from "@/components/ui/TextField";
import { apiSend } from "@/lib/api";
import { BankForm } from "@/lib/bankForm";

export type BankDefaults = { id?: string; code: string; name: string; sortOrder: number; managers: Option[] };

const searchManagers = async (q: string): Promise<Option[]> => {
  const res = await fetch(`/api/admin/users/options?q=${encodeURIComponent(q)}`);
  return res.ok ? res.json() : [];
};

export function BankFormDialog({ initial, canAssign, onClose }: { initial?: BankDefaults; canAssign: boolean; onClose: () => void }) {
  const router = useRouter();
  const start = initial ?? { code: "", name: "", sortOrder: 0, managers: [] };
  const [managers, setManagers] = useState<Option[]>(start.managers);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const raw = { code: f.get("code"), name: f.get("name"), sortOrder: f.get("sortOrder"), managerIds: managers.map((m) => m.id) };
    const parsed = BankForm.safeParse(raw);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    setFormError("");
    setPending(true);
    const r = start.id ? await apiSend("PATCH", `/api/admin/banks/${start.id}`, raw) : await apiSend("POST", "/api/admin/banks", raw);
    setPending(false);
    if (!r.ok) return r.field ? setErrors({ [r.field]: r.message }) : setFormError(r.message);
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      title={start.id ? "Sửa ngân hàng" : "Thêm ngân hàng"}
      onClose={onClose}
      dismissible={!pending}
      width={560}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="bank-form" disabled={pending}>
            {start.id ? "Lưu" : "Tạo ngân hàng"}
          </Button>
        </>
      }
    >
      <form id="bank-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="code" label="Mã ngân hàng" defaultValue={start.code} error={errors.code} autoCapitalize="characters" data-autofocus />
          <TextField name="sortOrder" label="Độ ưu tiên" inputMode="numeric" defaultValue={String(start.sortOrder)} error={errors.sortOrder} />
        </div>
        <TextField name="name" label="Tên ngân hàng" defaultValue={start.name} error={errors.name} />
        {canAssign && <MultiSelect label="Người quản ngân hàng này" value={managers} onChange={setManagers} search={searchManagers} placeholder="Gõ tên, tên đăng nhập hoặc mã tài khoản…" error={errors.managerIds} />}
        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
      </form>
    </Dialog>
  );
}
