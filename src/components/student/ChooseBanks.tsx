"use client";

import { clsx } from "clsx";
import { Check } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { studentApi } from "@/lib/studentApi";
import type { StudentState } from "@/lib/studentState";
import { AppHead, BankLogo, Bottom, EndBlock, Steps, ZaloBox } from "./parts";

const pickedMark = (
  <span className="anim-pop absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-accent text-on-accent ring-2 ring-bg">
    <Check size={15} strokeWidth={3} aria-hidden />
  </span>
);

type Edit = () => Promise<string | null>;

// Thanh bước của các màn dừng ở bước 2: bấm bước 1 thì chờ tải thông tin đã khai rồi mới chuyển màn.
function EditSteps({ onEdit }: { onEdit: Edit }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  return (
    <>
      <Steps
        current={2}
        pendingStep={pending ? 1 : null}
        onBack={async () => {
          setPending(true);
          setError((await onEdit()) ?? "");
          setPending(false);
        }}
      />
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      )}
    </>
  );
}

export function ChooseBanks({ state, notice, onDone, onEdit }: { state: StudentState; notice?: string; onDone: (notice?: string) => void; onEdit: Edit }) {
  const banks = state.eligibleBanks;
  const need = Math.min(2, banks.length);
  const [picked, setPicked] = useState<string[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const chosen = need === 1 ? [banks[0].id] : picked;

  const toggle = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : list.length < 2 ? [...list, id] : list));

  async function submit() {
    setPending(true);
    const r = await studentApi("POST", "/api/customers/me/banks", { bankIds: chosen });
    if (r.ok) return onDone();
    setPending(false);
    // Số ngân hàng còn lượt đổi giữa chừng (hết lượt, hay được trả lượt nên phải chọn 2): tải lại danh sách để chọn lại; câu 400 đã có ở dòng gợi ý nên không nhắc lại.
    if (r.status === 409 || r.field === "bankIds") return onDone(r.status === 409 ? r.message : undefined);
    setError(r.message);
  }

  const message = error || notice;
  return (
    <>
      <AppHead school={state.school.name} title={need === 2 ? "Chọn 2 ngân hàng" : "Chọn ngân hàng"} />
      <Steps
        current={2}
        pendingStep={editing ? 1 : null}
        onBack={async () => {
          setEditing(true);
          setError((await onEdit()) ?? "");
          setEditing(false);
        }}
      />
      <p className="text-sm text-text-2" aria-live="polite">
        {need === 2 ? `Chọn đúng 2 ngân hàng. Đã chọn ${chosen.length}/2.` : "Chỉ còn 1 ngân hàng chưa có tài khoản."}
      </p>
      <ul className="anim-stagger mt-3 grid grid-cols-2 gap-3">
        {banks.map((b) => {
          const slot = chosen.indexOf(b.id) + 1;
          const box = clsx("relative flex h-full w-full flex-col items-center gap-2 rounded-2xl border p-2.5 pb-3 text-center text-[15px] leading-tight font-semibold", slot ? "border-accent bg-accent-soft/40 shadow-md ring-1 ring-accent" : "border-field-border bg-card shadow-sm");
          return (
            <li key={b.id}>
              {need === 1 ? (
                <div className={box}>
                  <BankLogo src={b.logoUrl} />
                  {b.name}
                  {pickedMark}
                </div>
              ) : (
                <button type="button" aria-pressed={slot > 0} disabled={!slot && chosen.length >= 2} onClick={() => toggle(b.id)} className={clsx(box, "text-text disabled:opacity-50")}>
                  <BankLogo src={b.logoUrl} />
                  {b.name}
                  {slot > 0 && pickedMark}
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
        <Button large block disabled={chosen.length !== need || pending || editing} onClick={submit}>
          Tiếp tục
        </Button>
      </Bottom>
    </>
  );
}

export function NoBank({ state, onEdit }: { state: StudentState; onEdit: Edit }) {
  return (
    <>
      <AppHead school={state.school.name} title="Chọn ngân hàng" />
      <EditSteps onEdit={onEdit} />
      <EndBlock mark title="Không có ngân hàng nào phù hợp" hint="Đã có tài khoản ở tất cả ngân hàng trong chương trình." />
      <Bottom>
        <ZaloBox url={state.zaloUrl} text="Khai nhầm ngân hàng đã có: kết bạn Zalo để nhân viên sửa." />
      </Bottom>
    </>
  );
}

export function BanksFull({ state, onEdit }: { state: StudentState; onEdit: Edit }) {
  return (
    <>
      <AppHead school={state.school.name} title="Chọn ngân hàng" />
      <EditSteps onEdit={onEdit} />
      <EndBlock mark title="Ngân hàng đã hết lượt trong tháng này" />
      <Bottom>
        <ZaloBox url={state.zaloUrl} text="Cần hỏi: kết bạn Zalo với nhân viên." />
      </Bottom>
    </>
  );
}
