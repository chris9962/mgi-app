"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/users/ConfirmDialog";
import { rowActions, rowIconButton } from "@/components/ui/DataTable";
import { apiSend } from "@/lib/api";
import { CodeFormDialog, type CodeDefaults } from "./CodeFormDialog";

type Banks = { id: string; name: string }[];

export function AddCodeButton({ banks }: { banks: Banks }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)} disabled={!banks.length}>
        <Plus size={16} aria-hidden />
        Thêm mã
      </Button>
      {open && <CodeFormDialog banks={banks} onClose={() => setOpen(false)} />}
    </>
  );
}

export function CodeActions({ code, active, banks }: { code: Required<CodeDefaults>; active: boolean; banks: Banks }) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "toggle" | null>(null);
  return (
    <span className={rowActions}>
      <button
        type="button"
        className={rowIconButton}
        aria-label={`Sửa mã ${code.displayName}`}
        title="Sửa mã"
        onClick={() => setDialog("edit")}
      >
        <Pencil size={16} aria-hidden />
      </button>
      <button type="button" className="h-9 rounded-[10px] px-2.5 text-sm font-semibold whitespace-nowrap text-accent-ink hover:bg-surface" onClick={() => setDialog("toggle")}>
        {active ? "Ngừng" : "Dùng lại"}
      </button>
      {dialog === "edit" && <CodeFormDialog banks={banks} initial={code} onClose={() => setDialog(null)} />}
      {dialog === "toggle" && (
        <ConfirmDialog
          open
          title={active ? "Ngừng mã" : "Dùng lại mã"}
          text={active ? `Ngừng mã ${code.displayName}?` : `Dùng lại mã ${code.displayName}?`}
          confirmLabel={active ? "Ngừng" : "Dùng lại"}
          danger={active}
          onClose={() => setDialog(null)}
          onConfirm={async () => {
            const r = await apiSend("POST", `/api/admin/referral-codes/${code.id}/active`, { active: !active });
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
