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
      dismissible={!pending}
      width={420}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={onClose}>
            Huỷ
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            disabled={pending}
            onClick={async () => {
              setPending(true);
              // onConfirm ném lỗi mà không mở khoá thì Huỷ, Esc đều bị khoá mãi.
              try {
                const message = await onConfirm();
                if (message) setError(message);
              } finally {
                setPending(false);
              }
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
