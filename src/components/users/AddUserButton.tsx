"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { UserFormDialog } from "./UserFormDialog";

export function AddUserButton({ canGrantAdmin }: { canGrantAdmin: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus size={16} aria-hidden />
        Thêm tài khoản
      </Button>
      {open && <UserFormDialog open onClose={() => setOpen(false)} canGrantAdmin={canGrantAdmin} />}
    </>
  );
}
