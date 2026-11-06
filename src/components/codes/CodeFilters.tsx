"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { inputClass } from "@/components/ui/Field";
import { SEARCH_MAX_LENGTH } from "@/lib/search";

type Filters = { q: string; bankId: string; hideStopped: boolean };
type Shown = Filters & { month: string; page: string };

const same = (a: Shown, b: Shown) => a.q === b.q && a.bankId === b.bankId && a.hideStopped === b.hideStopped && a.month === b.month && a.page === b.page;

// Lọc ngay khi đổi như mgst-app, không có nút Lọc: ô tìm chờ gõ xong 300 ms rồi mới tải lại.
export function CodeFilters({ month, banks, ...initial }: Filters & { month: string; banks: { id: string; name: string }[] }) {
  const router = useRouter();
  const [q, setQ] = useState(initial.q);
  const [bankId, setBankId] = useState(initial.bankId);
  const [hideStopped, setHideStopped] = useState(initial.hideStopped);
  // URL đổi vì link hoặc nút Quay lại thì ô lọc hiện theo URL; URL đổi vì chính ô này gửi thì giữ nguyên chữ đang gõ dở.
  // So cả tháng, trang để lượt tải của ô tìm bị Tháng sau, nút Sau huỷ thì ô tìm vẫn về theo URL; so props chứ không so chuỗi query vì nút Quay lại đổi URL trước khi props mới tới.
  const shown = { ...initial, month, page: useSearchParams().get("page") ?? "" };
  const [synced, setSynced] = useState<Shown>(shown);
  const [sent, setSent] = useState<Shown | null>(null);
  if (!same(synced, shown)) {
    setSynced(shown);
    if (sent && same(sent, shown)) setSent(null);
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
    timer.current = null;
    const target = { ...next, q: next.q.trim(), month, page: "" };
    if (!same(target, synced)) setSent(target);
    const p = new URLSearchParams({ month, ...(target.q ? { q: target.q } : {}), ...(next.bankId ? { bank: next.bankId } : {}), ...(next.hideStopped ? { hide: "1" } : {}) });
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
          // Bấm link làm ô mất focus trước khi link chuyển trang: tải ngay lúc này thì lượt của link đi sau và thắng, mạng chậm cũng không bị kéo về Kho mã.
          onBlur={() => {
            if (timer.current) go(current);
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
