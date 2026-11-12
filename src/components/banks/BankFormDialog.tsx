"use client";

import { ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { MultiSelect, type Option } from "@/components/ui/MultiSelect";
import { TextField } from "@/components/ui/TextField";
import { apiSend } from "@/lib/api";
import { BankForm } from "@/lib/bankForm";
import { MAX_IMAGE_BYTES } from "@/lib/imageKey";

export type BankDefaults = { id?: string; code: string; name: string; sortOrder: number; logoKey: string | null; managers: Option[] };

const TOO_LARGE = "Ảnh lớn hơn 20 MB.";

const searchManagers = async (q: string): Promise<Option[]> => {
  const res = await fetch(`/api/admin/users/options?q=${encodeURIComponent(q)}`);
  return res.ok ? res.json() : [];
};

export function BankFormDialog({ initial, canAssign, onClose }: { initial?: BankDefaults; canAssign: boolean; onClose: () => void }) {
  const router = useRouter();
  const start = initial ?? { code: "", name: "", sortOrder: 0, logoKey: null, managers: [] };
  const [managers, setManagers] = useState<Option[]>(start.managers);
  const [logoKey, setLogoKey] = useState(start.logoKey);
  const [uploading, setUploading] = useState(false);
  const [logoError, setLogoError] = useState("");
  const logoErrorId = `${useId()}-logo-error`;
  const fileInput = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);

  async function pickLogo(file: File) {
    // Kiểm ở cả hai đầu như ảnh mẫu: Nginx chặn file trên 22 MB bằng trang HTML trước khi tới app.
    if (file.size > MAX_IMAGE_BYTES) return setLogoError(TOO_LARGE);
    setLogoError("");
    setUploading(true);
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/admin/uploads?folder=logos", { method: "POST", body }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setUploading(false);
    if (!res?.ok) return setLogoError(res?.status === 413 ? TOO_LARGE : (data?.message ?? "Không tải được logo."));
    setLogoKey(data.key);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const raw = { code: f.get("code"), name: f.get("name"), sortOrder: f.get("sortOrder"), managerIds: managers.map((m) => m.id), logoKey };
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
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="bank-form" disabled={pending || uploading}>
            {start.id ? "Lưu" : "Tạo ngân hàng"}
          </Button>
        </>
      }
    >
      <form id="bank-form" onSubmit={submit} noValidate className="flex flex-col gap-3.5 pb-1">
        <div className="grid grid-cols-2 items-start gap-3 narrow:grid-cols-1">
          <TextField name="code" label="Mã ngân hàng" defaultValue={start.code} error={errors.code} autoCapitalize="characters" data-autofocus />
          <TextField name="sortOrder" label="Độ ưu tiên" inputMode="numeric" defaultValue={String(start.sortOrder)} error={errors.sortOrder} />
        </div>
        <TextField name="name" label="Tên ngân hàng" defaultValue={start.name} error={errors.name} />
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px] text-text-2">Logo</span>
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void pickLogo(file);
            }}
          />
          <button
            type="button"
            aria-label={logoKey ? "Đổi logo" : "Chọn logo"}
            aria-describedby={logoError || errors.logoKey ? logoErrorId : undefined}
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="flex h-[72px] w-48 items-center justify-center gap-2 overflow-hidden rounded-[10px] border border-dashed border-field-border bg-surface text-sm text-text-2 hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
          >
            {uploading ? (
              "Đang tải ảnh…"
            ) : logoKey ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={`/api/admin/images?key=${encodeURIComponent(logoKey)}`} alt="" className="size-full bg-white object-contain" />
            ) : (
              <>
                <ImagePlus size={20} aria-hidden />
                Chọn logo
              </>
            )}
          </button>
          {(logoError || errors.logoKey) && (
            <span id={logoErrorId} role="alert" className="text-[12.5px] text-danger">
              {logoError || errors.logoKey}
            </span>
          )}
        </div>
        {canAssign && <MultiSelect label="Người quản ngân hàng này" value={managers} onChange={setManagers} search={searchManagers} placeholder="Gõ tên, tên đăng nhập hoặc mã tài khoản…" error={errors.managerIds} />}
        {formError && (
          <p role="alert" className="text-[12.5px] text-danger">
            {formError}
          </p>
        )}
      </form>
    </Dialog>
  );
}
