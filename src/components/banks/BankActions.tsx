"use client";

import { BookOpen, Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/users/ConfirmDialog";
import { apiSend } from "@/lib/api";
import { BankFormDialog, type BankDefaults } from "./BankFormDialog";
import { GuideDialog } from "./GuideDialog";

const iconButton = "grid size-9 place-items-center rounded-lg border border-line bg-card text-text-2 hover:bg-surface hover:text-text";

export function AddBankButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden />
        Thêm ngân hàng
      </Button>
      {open && <BankFormDialog canAssign onClose={() => setOpen(false)} />}
    </>
  );
}

export function BankActions({ bank, active, canAssign }: { bank: Required<BankDefaults>; active: boolean; canAssign: boolean }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"guide" | "edit" | "toggle" | null>(null);
  const close = () => setDialog(null);
  return (
    <span className="flex items-center gap-1.5">
      <button type="button" className={iconButton} aria-label={`Hướng dẫn mở tài khoản ${bank.name}`} title="Hướng dẫn mở tài khoản" onClick={() => setDialog("guide")}>
        <BookOpen size={16} aria-hidden />
      </button>
      <button type="button" className={iconButton} aria-label={`Sửa ngân hàng ${bank.name}`} title="Sửa ngân hàng" onClick={() => setDialog("edit")}>
        <Pencil size={16} aria-hidden />
      </button>
      <button type="button" className="h-9 rounded-lg px-2.5 text-sm font-semibold text-accent-ink hover:bg-surface" onClick={() => setDialog("toggle")}>
        {active ? "Tắt" : "Bật lại"}
      </button>
      {dialog === "guide" && (
        <GuideDialog
          bankId={bank.id}
          bankName={bank.name}
          onClose={() => {
            close();
            router.refresh();
          }}
        />
      )}
      {dialog === "edit" && <BankFormDialog initial={bank} canAssign={canAssign} onClose={close} />}
      {dialog === "toggle" && (
        <ConfirmDialog
          open
          title={active ? "Tắt ngân hàng" : "Bật lại ngân hàng"}
          text={active ? `Tắt ${bank.name}? Học sinh mới không chọn được ngân hàng này.` : `Bật lại ${bank.name}?`}
          confirmLabel={active ? "Tắt" : "Bật lại"}
          danger={active}
          onClose={close}
          onConfirm={async () => {
            const r = await apiSend("POST", `/api/admin/banks/${bank.id}/active`, { active: !active });
            if (!r.ok) return r.message;
            close();
            router.refresh();
            return null;
          }}
        />
      )}
    </span>
  );
}
