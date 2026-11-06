"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";
import { LOGIN_LOCK_MINUTES, LOGIN_MAX_ATTEMPTS, LOGIN_WARN_AFTER } from "@/lib/types";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  // Máy chủ cố ý không trả số lần còn lại (lộ tên đăng nhập có thật), nên trình duyệt tự đếm để nhắc như mgst-app.
  const [misses, setMisses] = useState({ username: "", count: 0 });
  const [warnOpen, setWarnOpen] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const username = String(form.get("username") ?? "").trim();
    const password = String(form.get("password") ?? "");
    if (!username || !password) {
      setError("Nhập tên đăng nhập và mật khẩu.");
      return;
    }
    setPending(true);
    setError("");
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (res.ok) {
        router.replace("/");
        router.refresh();
        return;
      }
      const body = await res.json().catch(() => null);
      if (body?.code === "bad_credentials") {
        const key = username.toLowerCase();
        const count = misses.username === key ? misses.count + 1 : 1;
        setMisses({ username: key, count });
        if (count >= LOGIN_WARN_AFTER) {
          setWarnOpen(true);
          setPending(false);
          return;
        }
      }
      if (body?.code === "locked") setMisses({ username: "", count: 0 });
      setError(body?.message ?? "Không đăng nhập được. Thử lại sau ít phút.");
    } catch {
      setError("Không đăng nhập được. Kiểm tra kết nối mạng rồi thử lại.");
    }
    setPending(false);
  }

  return (
    <>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <TextField name="username" label="Tài khoản" placeholder="Tên đăng nhập công ty cấp" autoComplete="username" autoCapitalize="none" spellCheck={false} />
        <PasswordField name="password" label="Mật khẩu" placeholder="Mật khẩu công ty cấp" autoComplete="current-password" />
        {error && (
          <p role="alert" className="rounded-[10px] border border-danger bg-danger-soft px-3.5 py-2.5 text-sm text-danger-ink">
            {error}
          </p>
        )}
        <Button type="submit" large block disabled={pending}>
          {pending ? "Đang kiểm tra…" : "Đăng nhập"}
        </Button>
      </form>
      <Dialog
        open={warnOpen}
        title="Sắp bị khoá"
        onClose={() => setWarnOpen(false)}
        footer={
          <Button data-autofocus onClick={() => setWarnOpen(false)}>
            Đã hiểu
          </Button>
        }
      >
        <p>
          Sai mật khẩu {misses.count} lần rồi, {LOGIN_MAX_ATTEMPTS} lần sẽ bị khoá tài khoản {LOGIN_LOCK_MINUTES} phút.
        </p>
      </Dialog>
    </>
  );
}
