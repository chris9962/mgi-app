"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/ui/Field";
import { SEARCH_MAX_LENGTH } from "@/server/search";

type Filters = { q: string; bankId: string; hideStopped: boolean };

const same = (a: Filters, b: Filters) => a.q === b.q && a.bankId === b.bankId && a.hideStopped === b.hideStopped;

// Lọc ngay khi đổi như mgst-app, không có nút Lọc: ô tìm chờ gõ xong 300 ms rồi mới tải lại.
export function CodeFilters({ month, banks, ...initial }: Filters & { month: string; banks: { id: string; name: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState(initial.q);
  const [bankId, setBankId] = useState(initial.bankId);
  const [hideStopped, setHideStopped] = useState(initial.hideStopped);
  // URL đổi vì link hoặc nút Quay lại thì ô lọc hiện theo URL; URL đổi vì chính ô này gửi thì giữ nguyên chữ đang gõ dở.
  const [synced, setSynced] = useState<Filters>(initial);
  const [sent, setSent] = useState<Filters | null>(null);
  if (!same(synced, initial)) {
    setSynced(initial);
    if (sent && same(sent, initial)) setSent(null);
    else {
      setQ(initial.q);
      setBankId(initial.bankId);
      setHideStopped(initial.hideStopped);
    }
  }
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Gõ rồi bấm sang trang khác trước 300 ms: huỷ lượt tải chờ, không thì trang mới bị kéo về Kho mã.
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const go = (next: Filters) => {
    if (timer.current) clearTimeout(timer.current);
    const target = { ...next, q: next.q.trim() };
    if (!same(target, synced)) setSent(target);
    const p = new URLSearchParams({ month, ...(next.q.trim() ? { q: next.q.trim() } : {}), ...(next.bankId ? { bank: next.bankId } : {}), ...(next.hideStopped ? { hide: "1" } : {}) });
    router.replace(`/banks/codes?${p}`);
  };
  const current = { q, bankId, hideStopped };

  return (
    <form
      role="search"
      className="flex flex-wrap items-end gap-3 border-b border-line p-4"
      onSubmit={(e) => {
        e.preventDefault();
        go(current);
      }}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code-q" className="text-[13px] text-text-2">
          Tìm mã
        </label>
        <input
          id="code-q"
          value={q}
          maxLength={SEARCH_MAX_LENGTH}
          placeholder="Tên hiển thị, mã text…"
          className={`${inputClass} w-60`}
          onChange={(e) => {
            const value = e.target.value;
            setQ(value);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => go({ ...current, q: value }), 300);
          }}
        />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="code-bank" className="text-[13px] text-text-2">
          Ngân hàng
        </label>
        <select
          id="code-bank"
          value={bankId}
          className={`${inputClass} w-48`}
          onChange={(e) => {
            setBankId(e.target.value);
            go({ ...current, bankId: e.target.value });
          }}
        >
          <option value="">Mọi ngân hàng</option>
          {banks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </div>
      <label className="inline-flex h-9 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={hideStopped}
          onChange={(e) => {
            setHideStopped(e.target.checked);
            go({ ...current, hideStopped: e.target.checked });
          }}
          className="size-[18px] accent-[var(--accent)]"
        />
        Ẩn mã đã ngừng
      </label>
    </form>
  );
}
