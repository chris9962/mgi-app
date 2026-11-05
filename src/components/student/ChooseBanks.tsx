"use client";

import { clsx } from "clsx";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { studentApi } from "@/lib/studentApi";
import type { StudentState } from "@/lib/studentState";
import { AppHead, Bottom, EndBlock, Steps, ZaloBox } from "./parts";

const slotBadge = (slot: number) => (
  <span className={clsx("rounded-full px-2.5 py-0.5 text-xs font-semibold", slot === 1 ? "bg-accent text-on-accent" : "bg-accent-soft text-accent-ink")}>Ngân hàng {slot}</span>
);

export function ChooseBanks({ state, notice, onDone }: { state: StudentState; notice?: string; onDone: (notice?: string) => void }) {
  const banks = state.eligibleBanks;
  const need = Math.min(2, banks.length);
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const chosen = need === 1 ? [banks[0].id] : picked;

  const toggle = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length < 2 ? [...list, id] : list));

  async function submit() {
    setPending(true);
    const r = await studentApi("POST", "/api/customers/me/banks", { bankIds: chosen });
    if (r.ok) return onDone();
    setPending(false);
    // Hết lượt giữa chừng: tải lại danh sách để học sinh chọn trong các ngân hàng còn lượt.
    if (r.status === 409) return onDone(r.message);
    setError(r.message);
  }

  const message = error || notice;
  return (
    <>
      <AppHead school={state.school.name} title={need === 2 ? "Chọn 2 ngân hàng" : "Chọn ngân hàng"} />
      <Steps current={2} />
      <p className="text-sm text-text-2" aria-live="polite">
        {need === 2 ? `Chọn đúng 2 ngân hàng. Đã chọn ${chosen.length}/2.` : "Chỉ còn 1 ngân hàng chưa có tài khoản."}
      </p>
      <ul className="mt-3 flex flex-col gap-2">
        {banks.map((b) => {
          const slot = chosen.indexOf(b.id) + 1;
          const box = clsx("flex min-h-12 w-full items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-left text-[15px] font-semibold", slot ? "border-accent bg-accent-soft/40" : "border-field-border bg-card");
          return (
            <li key={b.id}>
              {need === 1 ? (
                <div className={box}>
                  {b.name}
                  {slotBadge(1)}
                </div>
              ) : (
                <button type="button" aria-pressed={slot > 0} disabled={!slot && chosen.length >= 2} onClick={() => toggle(b.id)} className={clsx(box, "text-text disabled:opacity-50")}>
                  {b.name}
                  {slot > 0 && slotBadge(slot)}
                </button>
              )}
            </li>
          );
        })}
      </ul>
      {need === 1 && state.existingBanks.length > 0 && <p className="mt-3 text-sm text-text-2">Đã có: {state.existingBanks.join(", ")}.</p>}
      {message && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {message}
        </p>
      )}
      <Bottom>
        <Button large block disabled={chosen.length !== need || pending} onClick={submit}>
          Tiếp tục
        </Button>
      </Bottom>
    </>
  );
}

export function NoBank({ state }: { state: StudentState }) {
  return (
    <>
      <AppHead school={state.school.name} title="Chọn ngân hàng" />
      <Steps current={2} />
      <EndBlock mark title="Không có ngân hàng nào phù hợp" hint="Đã có tài khoản ở tất cả ngân hàng trong chương trình." />
      <Bottom>
        <ZaloBox url={state.zaloUrl} text="Khai nhầm ngân hàng đã có: kết bạn Zalo để nhân viên sửa." />
      </Bottom>
    </>
  );
}
