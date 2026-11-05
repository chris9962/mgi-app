"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Checkbox } from "@/components/ui/Checkbox";
import { Dialog } from "@/components/ui/Dialog";
import { Select } from "@/components/ui/Select";
import { TextField } from "@/components/ui/TextField";
import { apiSend } from "@/lib/api";
import { PERMISSION_LABEL, PERMISSIONS, ROLE_LABEL, ROLES, type Permission, type Role } from "@/lib/types";
import { UserForm } from "@/lib/userForm";
import { PasswordDialog } from "./PasswordDialog";

export type UserFormDefaults = {
  id?: string;
  fullName: string;
  staffCode: string;
  phone: string;
  username: string;
  role: Role;
  title: string;
  permissions: Permission[];
};

const EMPTY: UserFormDefaults = { fullName: "", staffCode: "", phone: "", username: "", role: "staff", title: "", permissions: [] };

export function UserFormDialog({ open, onClose, initial, canGrantAdmin }: { open: boolean; onClose: () => void; initial?: UserFormDefaults; canGrantAdmin: boolean }) {
  const router = useRouter();
  const start = initial ?? EMPTY;
  const [role, setRole] = useState<Role>(start.role);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [pending, setPending] = useState(false);
  const [created, setCreated] = useState<{ name: string; password: string } | null>(null);
  const editing = Boolean(start.id);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const f = new FormData(event.currentTarget);
    // Gửi dữ liệu thô, không gửi bản đã chuyển: máy chủ kiểm lại bằng cùng schema, mà schema chỉ nhận chuỗi.
    const raw = {
      fullName: f.get("fullName"),
      staffCode: f.get("staffCode"),
      phone: f.get("phone"),
      username: f.get("username"),
      role: f.get("role"),
      title: f.get("title"),
      permissions: f.getAll("permissions"),
    };
    const parsed = UserForm.safeParse(raw);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [String(i.path[0]), i.message])));
      return;
    }
    setErrors({});
    setFormError("");
    setPending(true);
    const r = editing
      ? await apiSend("PATCH", `/api/admin/users/${start.id}`, raw)
      : await apiSend<{ id: string; password: string }>("POST", "/api/admin/users", raw);
    setPending(false);
    if (!r.ok) {
      if (r.field) setErrors({ [r.field]: r.message });
      else setFormError(r.message);
      return;
    }
    router.refresh();
    if (!editing && r.data) setCreated({ name: parsed.data.fullName, password: r.data.password });
    else onClose();
  }

  if (created) return <PasswordDialog open name={created.name} password={created.password} onClose={onClose} />;

  const roles = ROLES.filter((r) => canGrantAdmin || r !== "admin" || start.role === "admin");
  return (
    <Dialog
      open={open}
      title={editing ? "Sửa tài khoản" : "Thêm tài khoản"}
      onClose={onClose}
      width={560}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Huỷ
          </Button>
          <Button type="submit" form="user-form" disabled={pending}>
            {editing ? "Lưu" : "Tạo tài khoản"}
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField name="fullName" label="Họ tên" defaultValue={start.fullName} error={errors.fullName} data-autofocus />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField name="staffCode" label="Mã tài khoản" placeholder="Không bắt buộc" defaultValue={start.staffCode} error={errors.staffCode} />
          <TextField name="phone" label="Số điện thoại" inputMode="numeric" defaultValue={start.phone} error={errors.phone} />
        </div>
        <TextField name="username" label="Tên đăng nhập" autoCapitalize="none" spellCheck={false} defaultValue={start.username} error={errors.username} />
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            name="role"
            label="Vai"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            options={roles.map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            error={errors.role}
          />
          <TextField name="title" label="Chức danh hiển thị" defaultValue={start.title} error={errors.title} />
        </div>
        {role === "staff" && (
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-[13px] text-text-2">Quyền</legend>
            {PERMISSIONS.map((p) => (
              <Checkbox key={p} name="permissions" value={p} label={PERMISSION_LABEL[p]} defaultChecked={start.permissions.includes(p)} />
            ))}
          </fieldset>
        )}
        {formError && (
          <p role="alert" className="text-sm text-danger">
            {formError}
          </p>
        )}
      </form>
    </Dialog>
  );
}
