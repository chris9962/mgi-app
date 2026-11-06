"use client";

import { ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { MultiSelect, type Option } from "@/components/ui/MultiSelect";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { apiSend } from "@/lib/api";
import { CodeForm } from "@/lib/codeForm";
import { httpLinkIn, readQrImage } from "@/lib/readQrImage";
import { MAX_IMAGE_BYTES } from "@/lib/imageKey";

const TOO_LARGE = "Ảnh lớn hơn 20 MB.";

export type CodeDefaults = {
  id?: string;
  bankId: string;
  displayName: string;
  code: string;
  qrKey: string | null;
  openUrl: string;
  monthlyQuota: number;
  priority: number;
  schools: Option[];
};

const searchSchools = async (q: string): Promise<Option[]> => {
  const res = await fetch(`/api/admin/schools/options?q=${encodeURIComponent(q)}`);
  return res.ok ? res.json() : [];
};

export function CodeFormDialog({ banks, initial, onClose }: { banks: { id: string; name: string }[]; initial?: CodeDefaults; onClose: () => void }) {
  const router = useRouter();
  const start: CodeDefaults = initial ?? { bankId: banks[0]?.id ?? "", displayName: "", code: "", qrKey: null, openUrl: "", monthlyQuota: 200, priority: 0, schools: [] };
  const [schools, setSchools] = useState<Option[]>(start.schools);
  const [qrKey, setQrKey] = useState(start.qrKey);
  const [openUrl, setOpenUrl] = useState(start.openUrl);
  const [qrNote, setQrNote] = useState("");
  const [uploading, setUploading] = useState(false);
  const [qrError, setQrError] = useState("");
  const qrErrorId = `${useId()}-qr-error`;
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  // Đọc link trong QR ngay trên trình duyệt như mgst-app, để người nhập thấy link và sửa được trước khi lưu.
  async function pickQr(file: File) {
    // Kiểm ở cả hai đầu như imageProblem của mgst-app: Nginx chặn file trên 22 MB bằng trang HTML trước khi tới app.
    if (file.size > MAX_IMAGE_BYTES) return setQrError(TOO_LARGE);
    setFormError("");
    setQrError("");
    setUploading(true);
    setQrNote("");
    const read = await readQrImage(file);
    if (read.ok) {
      const link = httpLinkIn(read.text);
      setOpenUrl(link);
      if (!link) setQrNote("QR không chứa link mở tài khoản.");
    } else setQrNote(read.message);
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/admin/uploads?folder=qr", { method: "POST", body }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setUploading(false);
    if (!res?.ok) return setQrError(res?.status === 413 ? TOO_LARGE : (data?.message ?? "Không tải được ảnh QR."));
    setQrKey(data.key);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    const raw = {
      bankId: start.id ? start.bankId : f.get("bankId"),
      displayName: f.get("displayName"),
      code: f.get("code"),
      qrKey,
      openUrl,
      monthlyQuota: f.get("monthlyQuota"),
      priority: f.get("priority"),
      schoolIds: schools.map((s) => s.id),
    };
    const parsed = CodeForm.safeParse(raw);
    if (!parsed.success) return setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
    setErrors({});
    setFormError("");
    setPending(true);
    const r = start.id ? await apiSend("PATCH", `/api/admin/referral-codes/${start.id}`, raw) : await apiSend("POST", "/api/admin/referral-codes", raw);
    setPending(false);
    if (!r.ok) return r.field ? setErrors({ [r.field]: r.message }) : setFormError(r.message);
    onClose();
    router.refresh();
  }

  return (
    <Dialog
      open
      title={start.id ? "Sửa mã giới thiệu" : "Thêm mã giới thiệu"}
      onClose={onClose}
      dismissible={!pending}
      width={600}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="code-form" disabled={pending || uploading}>
            {start.id ? "Lưu" : "Tạo mã"}
          </Button>
        </>
      }
    >
      <form id="code-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <Select name="bankId" label="Ngân hàng" defaultValue={start.bankId} disabled={Boolean(start.id)} options={banks.map((b) => ({ value: b.id, label: b.name }))} error={errors.bankId} />
        <TextField name="displayName" label="Tên hiển thị" defaultValue={start.displayName} error={errors.displayName} data-autofocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <span className="text-[13px] text-text-2">Ảnh QR</span>
            <input
              ref={fileInput}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (file) void pickQr(file);
              }}
            />
            {/* Khoá lúc đang tải: ảnh chọn trước tải xong sau thì ảnh QR là ảnh trước mà link là link của ảnh sau. */}
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              disabled={uploading}
              aria-describedby={qrError ? qrErrorId : undefined}
              className="flex min-h-[72px] items-center justify-center gap-2 overflow-hidden rounded-[10px] border border-dashed border-field-border bg-surface text-sm text-text-2 hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? (
                "Đang tải ảnh…"
              ) : qrKey ? (
                <img src={`/api/admin/images?key=${encodeURIComponent(qrKey)}`} alt="Ảnh QR đã chọn" className="h-[68px] w-auto" />
              ) : (
                <>
                  <ImagePlus size={20} aria-hidden />
                  Chọn ảnh QR
                </>
              )}
            </button>
            {qrError && (
              <span id={qrErrorId} role="alert" className="text-[13px] text-danger">
                {qrError}
              </span>
            )}
          </div>
          <TextField name="code" label="Mã text (Mã giới thiệu)" defaultValue={start.code} error={errors.code} />
        </div>
        <TextField name="openUrl" label="Link mở tài khoản trong QR" value={openUrl} onChange={(e) => setOpenUrl(e.target.value)} error={errors.openUrl} hint={qrNote || undefined} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="monthlyQuota" label="Số lượt mỗi tháng" inputMode="numeric" defaultValue={String(start.monthlyQuota)} error={errors.monthlyQuota} />
          <TextField name="priority" label="Độ ưu tiên" inputMode="numeric" defaultValue={String(start.priority)} error={errors.priority} />
        </div>
        <MultiSelect label="Trường dùng mã này" value={schools} onChange={setSchools} search={searchSchools} placeholder="Gõ để tìm trường…" error={errors.schoolIds} />
        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
      </form>
    </Dialog>
  );
}
