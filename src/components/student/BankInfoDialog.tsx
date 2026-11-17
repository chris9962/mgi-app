"use client";

import { clsx } from "clsx";
import { Globe, Phone, Smartphone } from "lucide-react";
import { useId, useState, type ReactNode } from "react";
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
      <div id={`${id}-panel-${tab}`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} className="anim-fade flex flex-col gap-5 pb-[env(safe-area-inset-bottom)]">
        {tab === "info" ? <InfoTab bank={bank} /> : <GuideTab steps={bank.steps} />}
      </div>
    </Dialog>
  );
}

// Dòng phụ dưới logo: năm thành lập và trụ sở, bỏ phần trống.
const facts = (bank: StudentBankInfo) => [bank.foundedYear && `Thành lập ${bank.foundedYear}`, bank.headquarters && `Trụ sở ${bank.headquarters}`].filter(Boolean).join(" · ");

const hostOf = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");

function InfoTab({ bank }: { bank: StudentBankInfo }) {
  const line = facts(bank);
  const pills = [
    bank.hotline && <Pill key="tel" href={`tel:${bank.hotline.replace(/[^0-9+*#]/g, "")}`} icon={<Phone size={14} aria-hidden />} label="Tổng đài" value={bank.hotline} />,
    bank.website && <Pill key="web" href={bank.website} external icon={<Globe size={14} aria-hidden />} label="Website" value={hostOf(bank.website)} />,
    bank.appName && <Pill key="app" icon={<Smartphone size={14} aria-hidden />} label="App" value={bank.appName} />,
  ].filter(Boolean);
  return (
    <>
      <div className="flex items-center gap-3">
        <div className="w-24 flex-none">
          <BankLogo src={bank.logoUrl} />
        </div>
        {line && <p className="min-w-0 text-[13px] leading-snug text-text-2">{line}</p>}
      </div>
      {pills.length > 0 && <div className="flex flex-wrap gap-2">{pills}</div>}
      <Overview text={bank.overview} />
    </>
  );
}

// Pill nhỏ: nhãn mờ và giá trị đậm trên một dòng, có link thì cả pill là link.
function Pill({ href, external, icon, label, value }: { href?: string; external?: boolean; icon: ReactNode; label: string; value: string }) {
  const body = (
    <>
      <span className="text-accent-ink">{icon}</span>
      <span className="text-text-2">{label}</span>
      <span className="font-semibold text-text tabular-nums">{value}</span>
    </>
  );
  const cls = "inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-full border border-line bg-card px-3 text-[13px] leading-none";
  if (!href) return <span className={cls}>{body}</span>;
  return (
    <a href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined} className={clsx(cls, "hover:border-accent hover:bg-accent-soft/40")}>
      {body}
    </a>
  );
}

// Giới thiệu: đoạn cách nhau bằng dòng trống, dòng bắt đầu bằng gạch đầu dòng gom thành danh sách.
function Overview({ text }: { text: string | null }) {
  if (!text) return <p className="text-sm text-text-3">Chưa có phần giới thiệu.</p>;
  const blocks = text.split(/\n\s*\n/);
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.every((l) => /^[-•]\s*/.test(l)))
          return (
            <ul key={i} className="flex list-disc flex-col gap-1 pl-5">
              {lines.map((l, j) => (
                <li key={j}>{l.replace(/^[-•]\s*/, "")}</li>
              ))}
            </ul>
          );
        return <p key={i}>{lines.join(" ")}</p>;
      })}
    </div>
  );
}

function GuideTab({ steps }: { steps: string[] }) {
  if (!steps.length) return <p className="text-sm text-text-3">Chưa có hướng dẫn.</p>;
  return (
    <ol className="flex flex-col gap-3">
      {steps.map((step, i) => (
        <li key={i} className="flex gap-3">
          <span aria-hidden className="grid size-7 flex-none place-items-center rounded-full bg-accent-soft text-[13px] font-semibold text-accent-ink">
            {i + 1}
          </span>
          <span className="min-w-0 pt-0.5 text-[15px] leading-relaxed">{step}</span>
        </li>
      ))}
    </ol>
  );
}
