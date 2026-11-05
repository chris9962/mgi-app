import { Users } from "lucide-react";
import Link from "next/link";
import { bankTag } from "@/components/customers/customerView";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { ExportButton } from "@/components/ui/ExportButton";
import { FilterChips } from "@/components/ui/FilterChips";
import { Pager } from "@/components/ui/Pager";
import { SearchBox } from "@/components/ui/SearchBox";
import { UrlFilters, type FilterDef } from "@/components/ui/UrlFilters";
import { CHECK_LABEL, CUSTOMER_STATUSES, CUSTOMER_STATUS_LABEL, PASSED_LABEL, customerFilterQuery, parseCustomerFilters, type CustomerFilters } from "@/lib/customerFilters";
import { formatDate, formatShortDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/text";
import { requirePage } from "@/server/auth/current";
import { listCustomers, PAGE_SIZE, type ListBank } from "@/server/customerList";

export const metadata = { title: "Hồ sơ học sinh" };

const DEFS: FilterDef[] = [
  { kind: "choice", id: "status", label: "Trạng thái", key: "status", options: [{ value: "", label: "Mọi trạng thái" }, ...CUSTOMER_STATUSES.map((s) => ({ value: s, label: CUSTOMER_STATUS_LABEL[s] }))] },
  { kind: "dates", id: "created", label: "Ngày", fromKey: "from", toKey: "to" },
  { kind: "choice", id: "passed", label: "Số ngân hàng đạt", key: "passed", options: [{ value: "", label: "Mọi hồ sơ" }, ...Object.entries(PASSED_LABEL).map(([value, label]) => ({ value, label }))] },
  { kind: "choice", id: "check", label: "Xác thực ảnh", key: "check", options: [{ value: "", label: "Mọi kết quả" }, ...Object.entries(CHECK_LABEL).map(([value, label]) => ({ value, label }))] },
];

function chipsOf(f: CustomerFilters) {
  const without = (...keys: (keyof CustomerFilters)[]) => `/customers?${customerFilterQuery({ ...f, ...Object.fromEntries(keys.map((k) => [k, ""])) })}`;
  const day = (v: string) => formatDate(`${v}T00:00:00+07:00`);
  const created = f.from && f.to ? `Ngày: ${day(f.from)} – ${day(f.to)}` : f.from ? `Từ ngày ${day(f.from)}` : f.to ? `Đến ngày ${day(f.to)}` : "";
  return [
    ...(f.status ? [{ label: `Trạng thái: ${CUSTOMER_STATUS_LABEL[f.status]}`, href: without("status") }] : []),
    ...(created ? [{ label: created, href: without("from", "to") }] : []),
    ...(f.passed ? [{ label: PASSED_LABEL[f.passed], href: without("passed") }] : []),
    ...(f.check ? [{ label: `Xác thực ảnh: ${CHECK_LABEL[f.check]}`, href: without("check") }] : []),
  ];
}

function BankCell({ bank, single }: { bank?: ListBank; single: boolean }) {
  if (!bank) return <span className="text-text-3">{single ? "Mở 1" : "Chưa chọn"}</span>;
  return (
    <span className="flex flex-col items-start gap-1">
      <span className="flex flex-wrap items-center gap-1.5 whitespace-nowrap">
        {bank.name} {bankTag(bank.status)}
      </span>
      {bank.check && <span className="text-xs text-text-3">Xác thực ảnh {bank.check.passed}/{bank.check.total}</span>}
    </span>
  );
}

export default async function CustomersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePage("customers");
  const sp = await searchParams;
  const f = parseCustomerFilters(sp);
  const { rows, total, page } = await listCustomers(user, f, Number(sp.page) || 1);
  const { q, ...rest } = f;
  const params = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== "")) as Record<string, string>;

  return (
    <>
      <TopBar
        title="Hồ sơ học sinh"
        actions={
          <>
            <SearchBox action="/customers" placeholder="Họ tên, SĐT phụ huynh…" defaultValue={q} hidden={params} />
            <UrlFilters path="/customers" params={{ ...params, ...(q ? { q } : {}) }} defs={DEFS} />
            {can(user, "export_excel") && <ExportButton href={`/api/admin/customers/export?${customerFilterQuery(f)}`} />}
          </>
        }
      />
      <main className="p-6">
        <FilterChips chips={chipsOf(f)} />
        <Card title="Hồ sơ học sinh" icon={<Users size={17} aria-hidden />} meta={`${total} hồ sơ`} pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-semibold tracking-wide text-text-2 uppercase">
                <tr className="border-b border-line">
                  {["Ngày", "Họ tên", "Lớp", "Trường", "SĐT phụ huynh", "Ngân hàng 1", "Ngân hàng 2", "Người kiểm"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((c) => {
                  const [one, two] = [c.banks.find((b) => b.slot === 1), c.banks.find((b) => b.slot === 2)];
                  return (
                    <tr key={c.id} className="border-b border-line align-top last:border-0">
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatShortDateTime(c.createdAt)}</td>
                      <td className="px-4 py-3 font-semibold">
                        <Link href={`/customers/${c.id}`} className="text-link hover:underline">
                          {c.fullName}
                        </Link>
                      </td>
                      <td className="px-4 py-3">{c.className}</td>
                      <td className="px-4 py-3">{c.schoolName}</td>
                      <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatPhone(c.parentPhone)}</td>
                      <td className="px-4 py-3">
                        <BankCell bank={one} single={false} />
                      </td>
                      <td className="px-4 py-3">
                        <BankCell bank={two} single={Boolean(one)} />
                      </td>
                      <td className="px-4 py-3">{c.reviewers.length ? c.reviewers.join(", ") : <span className="text-text-3">Chưa kiểm</span>}</td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-text-3">
                      {q || Object.keys(params).length ? "Không có hồ sơ khớp bộ lọc." : "Chưa có hồ sơ nào."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={total} pageSize={PAGE_SIZE} href={(p) => `/customers?${customerFilterQuery(f, { page: String(p) })}`} />
        </Card>
      </main>
    </>
  );
}
