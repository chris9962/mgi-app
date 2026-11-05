"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Combobox } from "@/components/ui/Combobox";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { apiSend } from "@/lib/api";
import { SchoolForm } from "@/lib/schoolForm";

export type SchoolDefaults = { id?: string; name: string; provinceCode: string; wardCode: string; contactName: string; contactPhone: string };

export function SchoolFormDialog({ provinces, initial, onClose }: { provinces: { code: string; name: string }[]; initial?: SchoolDefaults; onClose: () => void }) {
  const router = useRouter();
  const start = initial ?? { name: "", provinceCode: "", wardCode: "", contactName: "", contactPhone: "" };
  const [provinceCode, setProvinceCode] = useState(start.provinceCode);
  const [wardCode, setWardCode] = useState(start.wardCode);
  const [wards, setWards] = useState<{ code: string; name: string }[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  // Tải danh mục xã của tỉnh đang chọn từ máy chủ; đổi tỉnh thì bỏ kết quả của lượt tải cũ.
  useEffect(() => {
    if (!provinceCode) return;
    let stale = false;
    fetch(`/api/admin/wards?province=${provinceCode}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((rows) => !stale && setWards(rows))
      .catch(() => !stale && setFormError("Không tải được danh sách xã/phường."));
    return () => {
      stale = true;
    };
  }, [provinceCode]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const raw = { name: f.get("name"), provinceCode, wardCode, contactName: f.get("contactName"), contactPhone: f.get("contactPhone") };
    const parsed = SchoolForm.safeParse(raw);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    setFormError("");
    setPending(true);
    const r = start.id ? await apiSend("PATCH", `/api/admin/schools/${start.id}`, raw) : await apiSend("POST", "/api/admin/schools", raw);
    setPending(false);
    if (!r.ok) return r.field ? setErrors({ [r.field]: r.message }) : setFormError(r.message);
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      title={start.id ? "Sửa trường" : "Thêm trường"}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="school-form" disabled={pending}>
            {start.id ? "Lưu" : "Tạo trường"}
          </Button>
        </>
      }
    >
      <form id="school-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField name="name" label="Tên trường" defaultValue={start.name} error={errors.name} data-autofocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="Tỉnh/thành phố"
            value={provinceCode}
            onChange={(e) => {
              setProvinceCode(e.target.value);
              setWardCode("");
              setWards([]);
            }}
            options={[{ value: "", label: "Chọn tỉnh/thành phố" }, ...provinces.map((p) => ({ value: p.code, label: p.name }))]}
            error={errors.provinceCode}
          />
          <Combobox
            label="Xã/phường"
            name="wardCode"
            value={wardCode}
            onChange={setWardCode}
            options={wards.map((w) => ({ value: w.code, label: w.name }))}
            placeholder={provinceCode ? "Gõ để tìm xã/phường…" : "Chọn tỉnh trước"}
            disabled={!provinceCode}
            error={errors.wardCode}
          />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="contactName" label="Họ tên người liên hệ" defaultValue={start.contactName} error={errors.contactName} />
          <TextField name="contactPhone" label="SĐT người liên hệ" inputMode="numeric" defaultValue={start.contactPhone} error={errors.contactPhone} />
        </div>
        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
      </form>
    </Dialog>
  );
}
