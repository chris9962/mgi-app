import { Ticket } from "lucide-react";
import { BankTabs } from "@/components/banks/BankTabs";
import { AddCodeButton, CodeActions } from "@/components/codes/CodeActions";
import { CodeFilters } from "@/components/codes/CodeFilters";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { Pager } from "@/components/ui/Pager";
import { StatusTag } from "@/components/ui/StatusTag";
import { canManageAnyBank } from "@/lib/permissions";
import { currentYearMonth, isYearMonth } from "@/lib/month";
import { requirePageWhere } from "@/server/auth/current";
import { listBanks } from "@/server/banks";
import { listCodes, PAGE_SIZE, type CodeRow } from "@/server/referralCodes";

export const metadata = { title: "Mã giới thiệu" };

const STATUS: Record<CodeRow["status"], React.ReactNode> = {
  open: <StatusTag tone="ok">Còn chỗ</StatusTag>,
  full: <StatusTag tone="neutral">Hết chỗ</StatusTag>,
  stopped: <StatusTag tone="neutral">Đã ngừng</StatusTag>,
};

function Usage({ used, quota }: { used: number; quota: number }) {
  const pct = quota ? Math.min(100, Math.round((used * 100) / quota)) : 0;
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap tabular-nums">
      <span className="block h-1.5 w-16 overflow-hidden rounded-full bg-surface" aria-hidden>
        <span className="block h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </span>
      {used}/{quota}
    </span>
  );
}

export default async function CodesPage({ searchParams }: { searchParams: Promise<{ month?: string; q?: string; bank?: string; hide?: string; page?: string }> }) {
  const user = await requirePageWhere(canManageAnyBank);
  const sp = await searchParams;
  const month = sp.month && isYearMonth(sp.month) ? sp.month : currentYearMonth();
  const q = sp.q ?? "";
  const hideStopped = sp.hide === "1";
  const banks = await listBanks(user);
  const bankId = banks.some((b) => b.id === sp.bank) ? sp.bank! : "";
  const { rows, total, page } = await listCodes(user, { month, q, bankId, hideStopped, page: Number(sp.page) || 1 });
  const query = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ month, ...(q ? { q } : {}), ...(bankId ? { bank: bankId } : {}), ...(hideStopped ? { hide: "1" } : {}), ...extra });
    return `/banks/codes?${p}`;
  };
  const activeBanks = banks.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name }));

  return (
    <>
      <TopBar
        title="Ngân hàng & mã giới thiệu"
        actions={
          <>
            <MonthPicker month={month} href={(m) => query({ month: m })} />
            <AddCodeButton banks={activeBanks} />
          </>
        }
      />
      <main className="p-6">
        <BankTabs current="codes" />
        <Card title="Kho mã giới thiệu" icon={<Ticket size={17} aria-hidden />} meta={`${total} mã`} pad={false}>
          <CodeFilters month={month} q={q} bankId={bankId} hideStopped={hideStopped} banks={banks.map((b) => ({ id: b.id, name: b.name }))} />
          <div className="table-scroll">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-semibold tracking-wide text-text-2 uppercase">
                <tr className="border-b border-line">
                  {["Ngân hàng", "Tên hiển thị", "Ưu tiên", "Đã dùng", "Hoàn thành", "Đang giữ", "Không đạt", "Trường áp dụng", "Trạng thái", "Người tạo", "Thao tác"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => (
                  <tr key={c.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap">{c.bankName}</td>
                    <td className="px-4 py-3">
                      <span className="font-semibold">{c.displayName}</span>
                      {c.code && <span className="block text-xs text-text-3">{c.code}</span>}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c.priority}</td>
                    <td className="px-4 py-3">
                      <Usage used={c.used} quota={c.quota} />
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c.passed}</td>
                    <td className="px-4 py-3 tabular-nums">{c.holding}</td>
                    <td className="px-4 py-3 tabular-nums">{c.failed}</td>
                    <td className="px-4 py-3">{c.schools.length ? c.schools.map((s) => s.label).join(", ") : <span className="text-text-3">Chưa gắn</span>}</td>
                    <td className="px-4 py-3">{STATUS[c.status]}</td>
                    <td className="px-4 py-3 whitespace-nowrap">{c.createdByName ?? ""}</td>
                    <td className="px-4 py-3">
                      <CodeActions
                        active={c.active}
                        banks={activeBanks}
                        code={{
                          id: c.id,
                          bankId: c.bankId,
                          displayName: c.displayName,
                          code: c.code ?? "",
                          qrKey: c.qrKey,
                          openUrl: c.openUrl ?? "",
                          monthlyQuota: c.monthlyQuota,
                          priority: c.priority,
                          schools: c.schools,
                        }}
                      />
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={11} className="px-4 py-10 text-center text-text-3 mobile:text-left">
                      {q || bankId ? "Không có mã khớp bộ lọc." : "Chưa có mã giới thiệu nào."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={total} pageSize={PAGE_SIZE} href={(p) => query({ page: String(p) })} />
        </Card>
      </main>
    </>
  );
}
