import { Ticket } from "lucide-react";
import { BankTabs } from "@/components/banks/BankTabs";
import { AddCodeButton, CodeActions } from "@/components/codes/CodeActions";
import { CodeFilters } from "@/components/codes/CodeFilters";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { DataTable, EmptyRow, TableHead } from "@/components/ui/DataTable";
import { MonthPicker } from "@/components/ui/MonthPicker";
import { Pager } from "@/components/ui/Pager";
import { StatusTag } from "@/components/ui/StatusTag";
import { canManageAnyBank } from "@/lib/permissions";
import { currentYearMonth, isYearMonth } from "@/lib/month";
import { readParam, type Params } from "@/lib/urlParams";
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

export default async function CodesPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requirePageWhere(canManageAnyBank);
  const sp = await searchParams;
  const month = isYearMonth(readParam(sp, "month")) ? readParam(sp, "month") : currentYearMonth();
  const q = readParam(sp, "q");
  const hideStopped = readParam(sp, "hide") === "1";
  const banks = await listBanks(user);
  const bankId = banks.some((b) => b.id === readParam(sp, "bank")) ? readParam(sp, "bank") : "";
  const { rows, total, page } = await listCodes(user, { month, q, bankId, hideStopped, page: Number(readParam(sp, "page")) || 1 });
  const query = (extra: Record<string, string>) => {
    const p = new URLSearchParams({ month, ...(q ? { q } : {}), ...(bankId ? { bank: bankId } : {}), ...(hideStopped ? { hide: "1" } : {}), ...extra });
    return `/banks/codes?${p}`;
  };
  const activeBanks = banks.filter((b) => b.active).map((b) => ({ id: b.id, name: b.name }));
  // Hộp Sửa khoá ô ngân hàng nhưng vẫn phải có ngân hàng đã tắt của mã trong danh sách, không thì ô hiện nhầm ngân hàng đầu.
  const allBanks = banks.map((b) => ({ id: b.id, name: b.name }));

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
        <Card title="Kho mã giới thiệu" icon={<Ticket size={17} aria-hidden />} meta={`${total} mã`}>
          <CodeFilters month={month} q={q} bankId={bankId} hideStopped={hideStopped} banks={allBanks} />
          <DataTable caption="Mã giới thiệu, lượt dùng, trường áp dụng và trạng thái">
            <TableHead columns={["Ngân hàng", "Tên hiển thị", "Ưu tiên", "Đã dùng", "Hoàn thành", "Đang giữ", "Không đạt", "Trường áp dụng", "Trạng thái", "Người tạo", "Thao tác"]} />
            <tbody>
              {rows.map((c) => (
                <tr key={c.id}>
                  <td>{c.bankName}</td>
                  <td>
                    <span className="font-semibold">{c.displayName}</span>
                    {c.code && <span className="block text-xs text-text-3">{c.code}</span>}
                  </td>
                  <td className="tabular-nums">{c.priority}</td>
                  <td>
                    <Usage used={c.used} quota={c.quota} />
                  </td>
                  <td className="tabular-nums">{c.passed}</td>
                  <td className="tabular-nums">{c.holding}</td>
                  <td className="tabular-nums">{c.failed}</td>
                  <td>{c.schools.length ? c.schools.map((s) => s.label).join(", ") : <span className="text-text-3">Chưa gắn</span>}</td>
                  <td>{STATUS[c.status]}</td>
                  <td>{c.createdByName ?? ""}</td>
                  <td>
                    <CodeActions
                      active={c.active}
                      banks={allBanks}
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
                <EmptyRow colSpan={11}>
                  {q || bankId || hideStopped ? "Không có mã khớp bộ lọc." : "Chưa có mã giới thiệu nào."}
                </EmptyRow>
              )}
            </tbody>
          </DataTable>
          <Pager page={page} total={total} pageSize={PAGE_SIZE} href={(p) => query({ page: String(p) })} />
        </Card>
      </main>
    </>
  );
}
