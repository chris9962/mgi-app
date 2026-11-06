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
  // Như mgst-app: request đã đi thì đóng hộp không gọi nó về được, nên lúc đang chạy Huỷ, X, Esc đều không đóng.
  const requestClose = () => {
    if (!pending) onClose();
  };
  return (
    <Dialog
      open={open}
      title={title}
      onClose={requestClose}
      width={420}
      footer={
        <>
          <Button variant="secondary" disabled={pending} onClick={requestClose}>
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
