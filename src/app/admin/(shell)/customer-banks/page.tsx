import { Landmark } from "lucide-react";
import Link from "next/link";
import { bankTag } from "@/components/customers/customerView";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { DataTable, EmptyRow } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import { FilterChips } from "@/components/ui/FilterChips";
import { Pager } from "@/components/ui/Pager";
import { SearchBox } from "@/components/ui/SearchBox";
import { StatusTag, type Tone } from "@/components/ui/StatusTag";
import { UrlFilters, type FilterDef } from "@/components/ui/UrlFilters";
import { CHECK_LABEL, CUSTOMER_BANK_STATUSES, CUSTOMER_BANK_STATUS_LABEL, customerBankFilterQuery, type CustomerBankFilters } from "@/lib/customerBankFilters";
import { formatDate, formatShortDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requirePage } from "@/server/auth/current";
import { listCustomerBanks, PAGE_SIZE, readCustomerBankFilters, type BankCheck } from "@/server/customerBankList";

export const metadata = { title: "Ngân hàng" };

const PATH = "/customer-banks";

function CheckCell({ check }: { check: BankCheck | null }) {
  if (!check) return <span className="text-text-3">Chưa có</span>;
  if (check.status === "pending") return <StatusTag tone="progress">Đang kiểm</StatusTag>;
  if (check.status === "failed") return <StatusTag tone="neutral">Không kiểm được</StatusTag>;
  // Màu theo tỉ lệ đạt như mgst-app: đạt hết xanh, từ nửa trở lên cam, dưới nửa đỏ.
  const tone: Tone = check.total > 0 && check.passed === check.total ? "ok" : check.passed * 2 >= check.total ? "warn" : "danger";
  return (
    <StatusTag tone={tone}>
      <span className="tabular-nums">
        {check.passed}/{check.total}
      </span>
    </StatusTag>
  );
}

function chipsOf(f: CustomerBankFilters, bankNames: Map<string, string>, schools: { id: string; label: string }[]) {
  const without = (patch: Partial<CustomerBankFilters>) => `${PATH}?${customerBankFilterQuery({ ...f, ...patch })}`;
  const day = (v: string) => formatDate(`${v}T00:00:00+07:00`);
  const created = f.from && f.to ? `Ngày: ${day(f.from)} – ${day(f.to)}` : f.from ? `Từ ngày ${day(f.from)}` : f.to ? `Đến ngày ${day(f.to)}` : "";
  const banks = f.bank.flatMap((id) => bankNames.get(id) ?? []);
  return [
    ...(created ? [{ label: created, href: without({ from: "", to: "" }) }] : []),
    ...(banks.length ? [{ label: `Ngân hàng: ${banks.join(", ")}`, href: without({ bank: [] }) }] : []),
    ...(f.status ? [{ label: `Trạng thái: ${CUSTOMER_BANK_STATUS_LABEL[f.status]}`, href: without({ status: "" }) }] : []),
    ...(f.check ? [{ label: `Xác thực ảnh: ${CHECK_LABEL[f.check]}`, href: without({ check: "" }) }] : []),
    ...(schools.length ? [{ label: `Trường: ${schools.map((s) => s.label).join(", ")}`, href: without({ school: [] }) }] : []),
  ];
}

export default async function CustomerBanksPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePage("customers");
  const sp = await searchParams;
  const { filters: f, banks, schools } = await readCustomerBankFilters(user, sp);
  const { rows, total, page } = await listCustomerBanks(user, f, Number(sp.page) || 1);
  const params = Object.fromEntries(new URLSearchParams(customerBankFilterQuery({ ...f, q: "" })));
  const filtering = Boolean(f.q) || Object.keys(params).some((k) => k !== "dir");
  const defs: FilterDef[] = [
    { kind: "dates", id: "created", label: "Ngày", fromKey: "from", toKey: "to" },
    // Nhân viên quản một ngân hàng thì mọi dòng đã cùng ngân hàng, ô lọc không chọn ra được gì khác.
    ...(banks.length > 1 ? [{ kind: "choice" as const, id: "bank", label: "Ngân hàng", key: "bank", multiple: true, options: banks.map((b) => ({ value: b.id, label: b.name })) }] : []),
    { kind: "choice", id: "status", label: "Trạng thái", key: "status", options: [{ value: "", label: "Mọi trạng thái" }, ...CUSTOMER_BANK_STATUSES.map((s) => ({ value: s, label: CUSTOMER_BANK_STATUS_LABEL[s] }))] },
    { kind: "choice", id: "check", label: "Xác thực ảnh", key: "check", options: [{ value: "", label: "Mọi kết quả" }, ...Object.entries(CHECK_LABEL).map(([value, label]) => ({ value, label }))] },
    { kind: "search", id: "school", label: "Trường", key: "school", url: "/api/admin/customer-banks/schools", selected: schools, placeholder: "Gõ để tìm trường…" },
  ];
  const nextDir = f.dir === "desc" ? "asc" : "desc";

  return (
    <>
      <TopBar
        title="Ngân hàng"
        actions={
          <>
            <SearchBox action={PATH} placeholder="Họ tên, SĐT phụ huynh…" defaultValue={f.q} hidden={params} />
            <UrlFilters path={PATH} params={{ ...params, ...(f.q ? { q: f.q } : {}) }} defs={defs} />
            {can(user, "export_excel") && <ExportButton href={`/api/admin/customer-banks/export?${customerBankFilterQuery(f)}`} />}
          </>
        }
      />
      <main className="p-6">
        <FilterChips chips={chipsOf(f, new Map(banks.map((b) => [b.id, b.name])), schools)} />
        <Card title="Ngân hàng" icon={<Landmark size={17} aria-hidden />} meta={`${total} dòng`}>
          <DataTable caption="Ngân hàng học sinh chọn, mã giới thiệu, trạng thái và kết quả xác thực ảnh">
            <thead>
              <tr>
                <th scope="col" aria-sort={f.dir === "desc" ? "descending" : "ascending"}>
                  <Link href={`${PATH}?${customerBankFilterQuery({ ...f, dir: nextDir })}`} className="inline-flex items-center gap-1 hover:text-accent pointer-coarse:min-h-11">
                    Ngày
                    <span aria-hidden className="min-w-2 text-[10px]">{f.dir === "desc" ? "↓" : "↑"}</span>
                  </Link>
                </th>
                {["Ngân hàng", "Học sinh", "Mã giới thiệu", "Trường", "Trạng thái", "Xác thực ảnh", "Người kiểm"].map((h) => (
                  <th key={h} scope="col">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="align-top">
                  <td className="tabular-nums">{formatShortDateTime(r.createdAt)}</td>
                  <td>
                    <Link href={`/customers/${r.customerId}`} className="text-link hover:underline">
                      {r.bankName}
                    </Link>
                  </td>
                  <td>
                    <Link href={`/customers/${r.customerId}`} className="text-link hover:underline">
                      {r.fullName}
                    </Link>
                    <span className="block text-xs text-text-3">{r.className}</span>
                  </td>
                  <td className="font-mono">{r.referralCode}</td>
                  <td>{r.schoolName}</td>
                  <td>{bankTag(r.status, true)}</td>
                  <td>
                    <CheckCell check={r.check} />
                  </td>
                  <td>{r.reviewer ?? <span className="text-text-3">Chưa kiểm</span>}</td>
                </tr>
              ))}
              {!rows.length && (
                <EmptyRow colSpan={8}>
                  {filtering ? "Không có dòng nào khớp bộ lọc." : "Chưa có học sinh chọn ngân hàng."}
                </EmptyRow>
              )}
            </tbody>
          </DataTable>
          <Pager page={page} total={total} pageSize={PAGE_SIZE} href={(p) => `${PATH}?${customerBankFilterQuery(f, { page: String(p) })}`} />
        </Card>
      </main>
    </>
  );
}
