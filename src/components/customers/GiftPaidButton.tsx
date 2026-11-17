"use client";

import { BadgeCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/users/ConfirmDialog";
import { apiSend } from "@/lib/api";

export function GiftPaidButton({ customerId, fullName }: { customerId: string; fullName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <BadgeCheck size={16} aria-hidden />
        Đã chuyển quà
      </Button>
      {open && (
        <ConfirmDialog
          open
          title="Chuyển quà"
          text={`Đã chuyển 20.000 đồng cho ${fullName}?`}
          confirmLabel="Đã chuyển"
          onConfirm={async () => {
            const r = await apiSend("PATCH", `/api/admin/customers/${customerId}/gift`);
            if (!r.ok) return r.message;
            setOpen(false);
            router.refresh();
            return null;
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
