"use client";

import { Pencil, Plus, QrCode } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/users/ConfirmDialog";
import { apiSend } from "@/lib/api";
import { SchoolFormDialog, type SchoolDefaults } from "./SchoolFormDialog";

type Provinces = { code: string; name: string }[];
const iconButton = "grid size-9 place-items-center rounded-lg border border-line bg-card text-text-2 hover:bg-surface hover:text-text";

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

export function SchoolActions({ school, active, provinces }: { school: Required<SchoolDefaults>; active: boolean; provinces: Provinces }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "toggle" | null>(null);
  return (
    <span className="flex items-center gap-1.5">
      <a href={`/api/admin/schools/${school.id}/qr`} className={iconButton} aria-label={`Tải ảnh QR của ${school.name}`} title="Tải ảnh QR">
        <QrCode size={16} aria-hidden />
      </a>
      <button type="button" className={iconButton} aria-label={`Sửa trường ${school.name}`} title="Sửa trường" onClick={() => setDialog("edit")}>
        <Pencil size={16} aria-hidden />
      </button>
      <button type="button" className="h-9 rounded-lg px-2.5 text-sm font-semibold text-accent-ink hover:bg-surface" onClick={() => setDialog("toggle")}>
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
