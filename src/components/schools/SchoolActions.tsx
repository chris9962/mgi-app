"use client";

import { Check, Link2, Pencil, Plus, QrCode, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/users/ConfirmDialog";
import { rowActions, rowIconButton } from "@/components/ui/DataTable";
import { apiSend } from "@/lib/api";
import { SchoolFormDialog, type SchoolDefaults } from "./SchoolFormDialog";

type Provinces = { code: string; name: string }[];

export function AddSchoolButton({ provinces }: { provinces: Provinces }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden />
        Thêm trường
      </Button>
      {open && <SchoolFormDialog provinces={provinces} onClose={() => setOpen(false)} />}
    </>
  );
}

function CopyLinkButton({ link, name }: { link: string; name: string }) {
  const [copy, setCopy] = useState<"idle" | "done" | "failed">("idle");
  // Trang chạy http thì trình duyệt không có navigator.clipboard: phải báo không chép được.
  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopy("done");
    } catch {
      setCopy("failed");
    }
    setTimeout(() => setCopy("idle"), 2000);
  };
  const Icon = copy === "done" ? Check : copy === "failed" ? X : Link2;
  return (
    <>
      <button type="button" className={rowIconButton} aria-label={`Chép link của ${name}`} title={copy === "done" ? "Đã chép" : copy === "failed" ? "Không chép được" : "Chép link"} onClick={copyLink}>
        <Icon size={16} aria-hidden />
      </button>
      <span role="status" className="sr-only">
        {copy === "done" ? "Đã chép link" : copy === "failed" ? "Không chép được" : ""}
      </span>
    </>
  );
}

export function SchoolActions({ school, link, active, provinces }: { school: Required<SchoolDefaults>; link: string; active: boolean; provinces: Provinces }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "toggle" | null>(null);
  return (
    <span className={rowActions}>
      <CopyLinkButton link={link} name={school.name} />
      <a href={`/api/admin/schools/${school.id}/qr`} className={rowIconButton} aria-label={`Tải ảnh QR của ${school.name}`} title="Tải ảnh QR">
        <QrCode size={16} aria-hidden />
      </a>
      <button type="button" className={rowIconButton} aria-label={`Sửa trường ${school.name}`} title="Sửa trường" onClick={() => setDialog("edit")}>
        <Pencil size={16} aria-hidden />
      </button>
      <button type="button" className="h-9 rounded-[10px] px-2.5 text-sm font-semibold text-accent-ink hover:bg-surface" onClick={() => setDialog("toggle")}>
        {active ? "Đóng" : "Mở lại"}
      </button>
      {dialog === "edit" && <SchoolFormDialog provinces={provinces} initial={school} onClose={() => setDialog(null)} />}
      {dialog === "toggle" && (
        <ConfirmDialog
          open
          title={active ? "Đóng trường" : "Mở lại trường"}
          text={active ? `Đóng ${school.name}?` : `Mở lại ${school.name}?`}
          confirmLabel={active ? "Đóng" : "Mở lại"}
          danger={active}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const r = await apiSend("POST", `/api/admin/schools/${school.id}/active`, { active: !active });
            if (!r.ok) return r.message;
            setDialog(null);
            router.refresh();
            return null;
          }}
        />
      )}
    </span>
  );
}
