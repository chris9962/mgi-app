"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/users/ConfirmDialog";
import { apiSend } from "@/lib/api";

export function DeleteCustomerButton({ customerId, fullName }: { customerId: string; fullName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [leaving, startTransition] = useTransition();
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Trash2 size={16} aria-hidden />
        Xoá hồ sơ
      </Button>
      {open && (
        <ConfirmDialog
          open
          title="Xoá hồ sơ"
          text={`Xoá hồ sơ ${fullName}?`}
          confirmLabel="Xoá hồ sơ"
          danger
          busy={leaving}
          onConfirm={async () => {
            const r = await apiSend("DELETE", `/api/admin/customers/${customerId}`);
            if (!r.ok) return r.message;
            // Giữ hộp khoá tới khi rời trang: bấm Xoá lần hai trên hồ sơ đã xoá nhận 404.
            startTransition(() => router.replace("/customers"));
            return null;
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

export function DeleteCustomerBankButton({ customerBankId, bankName, fullName }: { customerBankId: string; bankName: string; fullName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [refreshing, startTransition] = useTransition();
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label={`Xoá ${bankName}`} className="grid size-8 place-items-center rounded-lg text-text-2 hover:bg-surface hover:text-danger">
        <Trash2 size={15} aria-hidden />
      </button>
      {open && (
        <ConfirmDialog
          open
          title="Xoá ngân hàng"
          text={`Xoá ${bankName} khỏi hồ sơ ${fullName}?`}
          confirmLabel="Xoá"
          danger
          busy={refreshing}
          onConfirm={async () => {
            const r = await apiSend("DELETE", `/api/admin/customer-banks/${customerBankId}`);
            if (!r.ok) return r.message;
            startTransition(() => {
              setOpen(false);
              router.refresh();
            });
            return null;
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
