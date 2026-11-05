"use client";

import { Pencil, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/users/ConfirmDialog";
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
    <span className="flex items-center gap-1.5">
      <button
        type="button"
        className="grid size-9 place-items-center rounded-lg border border-line bg-card text-text-2 hover:bg-surface hover:text-text"
        aria-label={`Sửa mã ${code.displayName}`}
        title="Sửa mã"
        onClick={() => setDialog("edit")}
      >
        <Pencil size={16} aria-hidden />
      </button>
      <button type="button" className="h-9 rounded-lg px-2.5 text-sm font-semibold whitespace-nowrap text-accent-ink hover:bg-surface" onClick={() => setDialog("toggle")}>
        {active ? "Ngừng" : "Dùng lại"}
      </button>
      {dialog === "edit" && <CodeFormDialog banks={banks} initial={code} onClose={() => setDialog(null)} />}
      {dialog === "toggle" && (
        <ConfirmDialog
          open
          title={active ? "Ngừng mã" : "Dùng lại mã"}
          text={active ? `Ngừng mã ${code.displayName}? Học sinh mới không nhận mã này nữa.` : `Dùng lại mã ${code.displayName}?`}
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
