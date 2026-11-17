"use client";

import { clsx } from "clsx";
import { Check, Info } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { studentApi } from "@/lib/studentApi";
import type { StudentBankInfo, StudentState } from "@/lib/studentState";
import { BankInfoDialog } from "./BankInfoDialog";
import { AppHead, BankLogo, Bottom, EndBlock, useStepBack, useStepNav, ZaloBox } from "./parts";

const pickedMark = (
  <span className="anim-pop absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-accent text-on-accent ring-2 ring-bg">
    <Check size={15} strokeWidth={3} aria-hidden />
  </span>
);

type Edit = () => Promise<string | null>;

// Đầu trang của các màn dừng ở bước 2: bấm bước 1 thì chờ tải thông tin đã khai rồi mới chuyển màn.
function EditHead({ onEdit }: { onEdit: Edit }) {
  const nav = useStepNav();
  const [error, setError] = useState("");
  useStepBack(nav, async () => {
    nav.setPending(1);
    setError((await onEdit()) ?? "");
    nav.setPending(null);
  });
  return (
    <>
      <AppHead title="Chọn ngân hàng" />
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
  // Còn đúng 1 ngân hàng thì chọn sẵn; còn nhiều thì chọn từ 1 tới hết.
  const single = banks.length === 1;
  const [picked, setPicked] = useState<string[]>([]);
  const [info, setInfo] = useState<StudentBankInfo | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const nav = useStepNav();
  const editing = nav.pending === 1;
  useStepBack(nav, async () => {
    nav.setPending(1);
    setError((await onEdit()) ?? "");
    nav.setPending(null);
  });
  const chosen = single ? [banks[0].id] : picked;

  const toggle = (id: string) => setPicked((list) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id]));

  async function submit() {
    setPending(true);
    const r = await studentApi("POST", "/api/customers/me/banks", { bankIds: chosen });
    if (r.ok) return onDone();
    setPending(false);
    // Số ngân hàng còn lượt đổi giữa chừng (hết lượt, hay được trả lượt): tải lại danh sách để chọn lại; câu 400 đã có ở dòng gợi ý nên không nhắc lại.
    if (r.status === 409 || r.field === "bankIds") return onDone(r.status === 409 ? r.message : undefined);
    setError(r.message);
  }

  const message = error || notice;
  return (
    <>
      <AppHead title="Chọn ngân hàng" />
      <p className="text-sm text-text-2" aria-live="polite">
        {single ? "Chỉ còn 1 ngân hàng chưa có tài khoản." : `Chọn một hay nhiều ngân hàng. Đã chọn ${chosen.length}.`}
      </p>
      <ul className="anim-stagger mt-3 grid grid-cols-2 gap-3">
        {banks.map((b) => {
          const slot = chosen.indexOf(b.id) + 1;
          const box = clsx("relative flex h-full w-full flex-col items-center gap-2 rounded-2xl border p-2.5 pb-4 text-center text-[15px] leading-tight font-semibold", slot ? "border-accent bg-accent-soft/40 shadow-md ring-1 ring-accent" : "border-field-border bg-card shadow-sm");
          const nameId = `bank-name-${b.id}`;
          return (
            <li key={b.id} className="relative">
              {single ? (
                <div className={box}>
                  <BankLogo src={b.logoUrl} />
                  <span id={nameId}>{b.name}</span>
                  {pickedMark}
                </div>
              ) : (
                <button type="button" aria-pressed={slot > 0} onClick={() => toggle(b.id)} className={clsx(box, "text-text")}>
                  <BankLogo src={b.logoUrl} />
                  <span id={nameId}>{b.name}</span>
                  {slot > 0 && pickedMark}
                </button>
              )}
              {/* Tên nút không chứa tên ngân hàng để không lẫn với nút chọn; tên ngân hàng đi theo aria-describedby. */}
              <button type="button" aria-label="Thông tin" aria-describedby={nameId} onClick={() => setInfo(b)} className="absolute -right-2.5 -bottom-2.5 z-10 grid size-7 place-items-center rounded-full bg-card text-accent-ink shadow-md ring-1 ring-line transition-transform duration-200 hover:scale-110 active:scale-95">
                <Info size={15} aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
      {single && state.existingBanks.length > 0 && <p className="mt-3 text-sm text-text-2">Đã có: {state.existingBanks.join(", ")}.</p>}
      {message && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {message}
        </p>
      )}
      {info && <BankInfoDialog bank={info} pick={single ? undefined : { picked: chosen.includes(info.id), onToggle: () => toggle(info.id) }} onClose={() => setInfo(null)} />}
      <Bottom sticky>
        <Button large block disabled={!chosen.length || pending || editing} onClick={submit}>
          Tiếp tục
        </Button>
      </Bottom>
    </>
  );
}

export function NoBank({ state, onEdit }: { state: StudentState; onEdit: Edit }) {
  return (
    <>
      <EditHead onEdit={onEdit} />
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
      <EditHead onEdit={onEdit} />
      <EndBlock mark title="Ngân hàng đã hết lượt trong tháng này" />
      <Bottom>
        <ZaloBox url={state.zaloUrl} text="Cần hỏi: kết bạn Zalo với nhân viên." />
      </Bottom>
    </>
  );
}
