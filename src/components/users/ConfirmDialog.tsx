"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";

export function ConfirmDialog({ open, title, text, confirmLabel, danger, onConfirm, onClose }: {
  open: boolean;
  title: string;
  text: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<string | null>;
  onClose: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      width={420}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              const message = await onConfirm();
              setPending(false);
              if (message) setError(message);
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm">{text}</p>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </Dialog>
  );
}
