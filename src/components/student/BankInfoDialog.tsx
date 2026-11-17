"use client";

import { clsx } from "clsx";
import { Phone } from "lucide-react";
import { useId, useState } from "react";
import { Dialog } from "@/components/ui/Dialog";
import type { StudentBankInfo } from "@/lib/studentState";
import { BankLogo } from "./parts";

const TABS = [
  { key: "info", label: "Thông tin" },
  { key: "guide", label: "Hướng dẫn mở tài khoản" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function BankInfoDialog({ bank, onClose }: { bank: StudentBankInfo; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("info");
  const id = useId();
  return (
    <Dialog open fullscreen title={bank.name} onClose={onClose}>
      <div role="tablist" aria-label="Nội dung ngân hàng" className="grid grid-cols-2 rounded-xl bg-surface p-1 text-sm font-semibold">
        {TABS.map((t) => (
          <button
            key={t.key}
            id={`${id}-tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`${id}-panel-${t.key}`}
            tabIndex={tab === t.key ? 0 : -1}
            onClick={() => setTab(t.key)}
            onKeyDown={(e) => {
              if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
              e.preventDefault();
              const next = TABS[(TABS.findIndex((x) => x.key === tab) + (e.key === "ArrowRight" ? 1 : TABS.length - 1)) % TABS.length].key;
              setTab(next);
              document.getElementById(`${id}-tab-${next}`)?.focus();
            }}
            className={clsx("min-h-10 rounded-lg px-2 transition-colors duration-200", tab === t.key ? "bg-card text-text shadow-sm" : "text-text-2")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`${id}-panel-${tab}`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} className="anim-fade flex flex-col gap-4 pb-[env(safe-area-inset-bottom)]">
        {tab === "info" ? <InfoTab bank={bank} /> : <GuideTab steps={bank.steps} />}
      </div>
    </Dialog>
  );
}

function InfoTab({ bank }: { bank: StudentBankInfo }) {
  return (
    <>
      <div className="mx-auto w-44">
        <BankLogo src={bank.logoUrl} />
      </div>
      {bank.hotline && (
        <a href={`tel:${bank.hotline.replace(/[^0-9+*#]/g, "")}`} className="flex items-center gap-3 rounded-2xl border border-line bg-card p-3 shadow-sm hover:bg-surface">
          <span aria-hidden className="grid size-10 flex-none place-items-center rounded-full bg-accent-soft text-accent-ink">
            <Phone size={18} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[13px] text-text-2">Tổng đài</span>
            <span className="font-semibold tabular-nums">{bank.hotline}</span>
          </span>
        </a>
      )}
      {bank.overview ? <p className="whitespace-pre-line text-[15px] leading-relaxed">{bank.overview}</p> : <p className="text-sm text-text-3">Chưa có thông tin tổng quan.</p>}
    </>
  );
}

function GuideTab({ steps }: { steps: string[] }) {
  if (!steps.length) return <p className="text-sm text-text-3">Chưa có hướng dẫn.</p>;
  return (
    <ol className="flex list-decimal flex-col gap-2 pl-5 text-[15px] leading-relaxed">
      {steps.map((step, i) => (
        <li key={i}>{step}</li>
      ))}
    </ol>
  );
}
