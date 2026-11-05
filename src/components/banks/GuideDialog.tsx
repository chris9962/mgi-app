"use client";

import { ImagePlus, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { inputClass } from "@/components/ui/Field";
import { apiSend } from "@/lib/api";
import { GuideForm } from "@/lib/bankForm";

type Slot = { key: string; id?: string; name: string; sampleKey: string | null; checkName: boolean; checkCode: boolean };

let counter = 0;
const localKey = () => `new-${++counter}`;

export function GuideDialog({ bankId, bankName, onClose }: { bankId: string; bankName: string; onClose: () => void }) {
  const [steps, setSteps] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [uploading, setUploading] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const uploadFor = useRef<string | null>(null);

  // Tải hướng dẫn đang lưu của ngân hàng từ máy chủ khi mở hộp thoại.
  useEffect(() => {
    let stale = false;
    fetch(`/api/admin/banks/${bankId}/guide`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((g: { steps: string[]; slots: Omit<Slot, "key">[] }) => {
        if (stale) return;
        setSteps(g.steps.join("\n"));
        setSlots(g.slots.length ? g.slots.map((s) => ({ ...s, key: s.id ?? localKey() })) : [{ key: localKey(), name: "", sampleKey: null, checkName: true, checkCode: true }]);
      })
      .catch(() => !stale && setError("Không tải được hướng dẫn."));
    return () => {
      stale = true;
    };
  }, [bankId]);

  const patch = (key: string, change: Partial<Slot>) => setSlots((list) => list?.map((s) => (s.key === key ? { ...s, ...change } : s)) ?? null);

  async function upload(file: File) {
    const key = uploadFor.current;
    if (!key) return;
    setUploading(key);
    const body = new FormData();
    body.set("file", file);
    const res = await fetch("/api/admin/uploads?folder=samples", { method: "POST", body }).catch(() => null);
    const data = await res?.json().catch(() => null);
    setUploading(null);
    if (!res?.ok) return setError(data?.message ?? "Không tải được ảnh mẫu.");
    patch(key, { sampleKey: data.key });
  }

  async function save() {
    if (!slots) return;
    const raw = {
      steps: steps.split("\n").map((s) => s.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean),
      slots: slots.map(({ id, name, sampleKey, checkName, checkCode }) => ({ ...(id ? { id } : {}), name, sampleKey, checkName, checkCode })),
    };
    const parsed = GuideForm.safeParse(raw);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
    setPending(true);
    const r = await apiSend("PUT", `/api/admin/banks/${bankId}/guide`, raw);
    setPending(false);
    if (!r.ok) return setError(r.message);
    onClose();
  }

  return (
    <Dialog
      open
      title={`Hướng dẫn mở tài khoản - ${bankName}`}
      onClose={onClose}
      width={600}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button onClick={save} disabled={pending || !slots || uploading !== null}>
            Lưu
          </Button>
        </>
      }
    >
      {!slots && !error && <p className="text-sm text-text-3">Đang tải…</p>}
      {/* Chỉ hiện ô nhập khi đã tải xong, không thì dữ liệu tải về sau ghi đè lên chữ người dùng vừa gõ. */}
      {slots && (
      <>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="guide-steps" className="text-[13px] text-text-2">
          Các bước
        </label>
        <textarea id="guide-steps" rows={5} value={steps} onChange={(e) => setSteps(e.target.value)} placeholder="Mỗi dòng một bước" className={`${inputClass} leading-6`} data-autofocus />
      </div>
      <fieldset className="flex flex-col gap-3">
        <legend className="mb-1.5 text-[13px] text-text-2">Ảnh cần nộp</legend>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void upload(file);
          }}
        />
        {slots?.map((s, i) => (
          <div key={s.key} className="flex items-start gap-2.5">
            <button
              type="button"
              aria-label={`Đổi ảnh mẫu của ${s.name || `ảnh ${i + 1}`}`}
              title="Đổi ảnh mẫu"
              onClick={() => {
                uploadFor.current = s.key;
                fileInput.current?.click();
              }}
              className="grid h-[52px] w-10 flex-none place-items-center overflow-hidden rounded-md border border-line bg-surface text-text-3 hover:border-accent"
            >
              {uploading === s.key ? "…" : s.sampleKey ? <img src={`/api/admin/images?key=${encodeURIComponent(s.sampleKey)}`} alt="" className="size-full object-cover" /> : <ImagePlus size={16} aria-hidden />}
            </button>
            <div className="flex flex-1 flex-col gap-1">
              <input aria-label={`Tên ảnh ${i + 1}`} value={s.name} placeholder="Ví dụ: Ảnh màn hình chính" onChange={(e) => patch(s.key, { name: e.target.value })} className={inputClass} />
              <div className="flex flex-wrap items-center gap-x-3 text-[13px] text-text-2">
                <span>Kiểm trên ảnh</span>
                <Checkbox label="Họ tên" checked={s.checkName} onChange={(e) => patch(s.key, { checkName: e.target.checked })} />
                <Checkbox label="Mã giới thiệu" checked={s.checkCode} onChange={(e) => patch(s.key, { checkCode: e.target.checked })} />
              </div>
            </div>
            <button
              type="button"
              aria-label={`Bỏ ${s.name || `ảnh ${i + 1}`}`}
              onClick={() => setSlots((list) => list?.filter((x) => x.key !== s.key) ?? null)}
              className="mt-0.5 grid size-9 flex-none place-items-center rounded-lg border border-line text-text-2 hover:bg-surface"
            >
              <X size={16} aria-hidden />
            </button>
          </div>
        ))}
        <Button variant="secondary" className="self-start" onClick={() => setSlots((list) => [...(list ?? []), { key: localKey(), name: "", sampleKey: null, checkName: false, checkCode: false }])}>
          <Plus size={16} aria-hidden />
          Thêm ảnh
        </Button>
      </fieldset>
      </>
      )}
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}
