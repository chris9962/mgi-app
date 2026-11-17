"use client";

import { clsx } from "clsx";
import { useId, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { splitBankName } from "@/lib/bankName";
import type { StudentBankInfo } from "@/lib/studentState";
import { BankLogo } from "./parts";

const TABS = [
  { key: "about", label: "Giới thiệu" },
  { key: "guide", label: "Hướng dẫn" },
] as const;
type Tab = (typeof TABS)[number]["key"];

const hostOf = (url: string) => url.replace(/^https?:\/\/(www\.)?/, "").replace(/\/.*$/, "");

// pick: nút chọn ở đáy hộp; không truyền khi màn chỉ còn một ngân hàng.
export type BankPick = { picked: boolean; full: boolean; onToggle: () => void };

export function BankInfoDialog({ bank, pick, onClose }: { bank: StudentBankInfo; pick?: BankPick; onClose: () => void }) {
  const [tab, setTab] = useState<Tab>("about");
  const id = useId();
  const name = splitBankName(bank.name);
  const footer = pick && (
    <div className="w-full">
      {pick.picked ? (
        <Button large block variant="secondary" onClick={() => (pick.onToggle(), onClose())}>
          Bỏ chọn
        </Button>
      ) : (
        <Button large block disabled={pick.full} onClick={() => (pick.onToggle(), onClose())}>
          Chọn ngân hàng này
        </Button>
      )}
    </div>
  );
  return (
    <Dialog open fullscreen title={name.short} onClose={onClose} footer={footer}>
      <div className="flex items-center gap-3.5">
        <div className="w-28 flex-none">
          <BankLogo src={bank.logoUrl} />
        </div>
        <div className="min-w-0 text-[13px] leading-snug text-text-2">
          {name.long && <p className="font-medium text-text">{name.long}</p>}
          {(bank.foundedYear || bank.headquarters) && <p>{[bank.foundedYear && `Thành lập ${bank.foundedYear}`, bank.headquarters].filter(Boolean).join(" · ")}</p>}
        </div>
      </div>
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
              const next = TABS[(TABS.findIndex((x) => x.key === tab) + 1) % TABS.length].key;
              setTab(next);
              document.getElementById(`${id}-tab-${next}`)?.focus();
            }}
            className={clsx("min-h-10 rounded-lg px-2 transition-colors duration-200", tab === t.key ? "bg-card text-text shadow-sm" : "text-text-2")}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div id={`${id}-panel-${tab}`} role="tabpanel" aria-labelledby={`${id}-tab-${tab}`} className="anim-fade flex flex-col gap-4">
        {tab === "about" ? <AboutTab bank={bank} /> : <GuideTab steps={bank.steps} />}
      </div>
    </Dialog>
  );
}

function AboutTab({ bank }: { bank: StudentBankInfo }) {
  const tel = bank.hotline?.replace(/[^0-9+*#]/g, "");
  const rows: [string, ReactNode][] = [];
  if (bank.hotline)
    rows.push([
      "Tổng đài",
      <a key="tel" href={`tel:${tel}`} className="text-accent-ink tabular-nums underline-offset-2 hover:underline">
        {bank.hotline}
      </a>,
    ]);
  if (bank.website)
    rows.push([
      "Website",
      <a key="web" href={bank.website} target="_blank" rel="noopener noreferrer" className="text-accent-ink underline-offset-2 hover:underline">
        {hostOf(bank.website)}
      </a>,
    ]);
  if (bank.appName) rows.push(["App", bank.appName]);
  if (!rows.length && !bank.overview) return <p className="text-sm text-text-3">Chưa có thông tin.</p>;
  return (
    <>
      {rows.length > 0 && (
        <dl className="divide-y divide-line rounded-2xl border border-line bg-card">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-center justify-between gap-4 px-4 py-3 text-[15px]">
              <dt className="text-text-2">{label}</dt>
              <dd className="min-w-0 text-right font-semibold wrap-anywhere">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      <Overview text={bank.overview} />
    </>
  );
}

// Giới thiệu: đoạn cách nhau bằng dòng trống, dòng bắt đầu bằng gạch đầu dòng gom thành danh sách.
function Overview({ text }: { text: string | null }) {
  if (!text) return null;
  const blocks = text.split(/\n\s*\n/);
  return (
    <div className="flex flex-col gap-3 text-[15px] leading-relaxed">
      {blocks.map((block, i) => {
        const lines = block.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.every((l) => /^[-•]\s*/.test(l)))
          return (
            <ul key={i} className="flex flex-col gap-1.5">
              {lines.map((l, j) => (
                <li key={j} className="flex gap-2.5">
                  <span aria-hidden className="mt-[9px] size-1.5 flex-none rounded-full bg-accent" />
                  <span className="min-w-0">{l.replace(/^[-•]\s*/, "")}</span>
                </li>
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
