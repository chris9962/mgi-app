"use client";

import { KeyRound, Lock, LockOpen, Pencil } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { apiSend } from "@/lib/api";
import { ConfirmDialog } from "./ConfirmDialog";
import { PasswordDialog } from "./PasswordDialog";
import { UserFormDialog, type UserFormDefaults } from "./UserFormDialog";

type Props = { user: UserFormDefaults & { id: string; active: boolean; loginLocked: boolean }; canManage: boolean; isSelf: boolean; canGrantAdmin: boolean; variant: "row" | "detail" };

const iconButton = "grid size-9 place-items-center rounded-lg border border-line bg-card text-text-2 hover:bg-surface hover:text-text";

export function UserActions({ user, canManage, isSelf, canGrantAdmin, variant }: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<"edit" | "lock" | "reset" | null>(null);
  const [password, setPassword] = useState("");
  if (!canManage) return null;
  const close = () => setDialog(null);
  // Tài khoản bị khoá tạm vì sai mật khẩu cũng mở bằng nút Mở khoá: máy chủ xoá luôn bộ đếm sai.
  const unlock = !user.active || user.loginLocked;
  const lockLabel = unlock ? "Mở khoá tài khoản" : "Khoá tài khoản";

  return (
    <>
      {variant === "row" ? (
        <span className="flex gap-1.5">
          <button type="button" className={iconButton} aria-label={`Sửa tài khoản ${user.fullName}`} title="Sửa tài khoản" onClick={() => setDialog("edit")}>
            <Pencil size={16} aria-hidden />
          </button>
          {!isSelf && (
            <button type="button" className={iconButton} aria-label={`${lockLabel} ${user.fullName}`} title={lockLabel} onClick={() => setDialog("lock")}>
              {unlock ? <LockOpen size={16} aria-hidden /> : <Lock size={16} aria-hidden />}
            </button>
          )}
        </span>
      ) : (
        <div className="flex flex-wrap gap-2 border-t border-line pt-4">
          <Button variant="secondary" onClick={() => setDialog("edit")}>
            <Pencil size={16} aria-hidden />
            Sửa
          </Button>
          <Button variant="secondary" onClick={() => setDialog("reset")}>
            <KeyRound size={16} aria-hidden />
            Đặt lại mật khẩu
          </Button>
          {!isSelf && (
            <Button variant={unlock ? "secondary" : "danger"} onClick={() => setDialog("lock")}>
              {unlock ? <LockOpen size={16} aria-hidden /> : <Lock size={16} aria-hidden />}
              {lockLabel}
            </Button>
          )}
        </div>
      )}
      {dialog === "edit" && <UserFormDialog open onClose={close} initial={user} canGrantAdmin={canGrantAdmin} />}
      {dialog === "lock" && (
        <ConfirmDialog
          open
          title={lockLabel}
          text={unlock ? `Mở khoá tài khoản ${user.fullName}?` : `Khoá tài khoản ${user.fullName}?`}
          confirmLabel={unlock ? "Mở khoá" : "Khoá"}
          danger={!unlock}
          onClose={close}
          onConfirm={async () => {
            const r = await apiSend("POST", `/api/admin/users/${user.id}/lock`, { active: unlock });
            if (!r.ok) return r.message;
            close();
            router.refresh();
            return null;
          }}
        />
      )}
      {dialog === "reset" && (
        <ConfirmDialog
          open
          title="Đặt lại mật khẩu"
          text={`Đặt lại mật khẩu cho ${user.fullName}?`}
          confirmLabel="Đặt lại"
          onClose={close}
          onConfirm={async () => {
            const r = await apiSend<{ password: string }>("POST", `/api/admin/users/${user.id}/reset-password`);
            if (!r.ok) return r.message;
            setPassword(r.data.password);
            setDialog(null);
            return null;
          }}
        />
      )}
      {password && <PasswordDialog open name={user.fullName} password={password} onClose={() => setPassword("")} />}
    </>
  );
}
