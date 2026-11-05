import { Landmark } from "lucide-react";
import Link from "next/link";
import { bankTag } from "@/components/customers/customerView";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { ExportButton } from "@/components/ui/ExportButton";
import { FilterChips } from "@/components/ui/FilterChips";
import { Pager } from "@/components/ui/Pager";
import { SearchBox } from "@/components/ui/SearchBox";
import { StatusTag, type Tone } from "@/components/ui/StatusTag";
import { UrlFilters, type FilterDef } from "@/components/ui/UrlFilters";
import { CHECK_LABEL, CUSTOMER_BANK_STATUSES, CUSTOMER_BANK_STATUS_LABEL, customerBankFilterQuery, parseCustomerBankFilters, type CustomerBankFilters } from "@/lib/customerBankFilters";
import { formatDate, formatShortDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { requirePage } from "@/server/auth/current";
import { listCustomerBanks, PAGE_SIZE, scopedBanks, type BankCheck } from "@/server/customerBankList";
import { schoolLabels } from "@/server/schools";

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
  const f = parseCustomerBankFilters(sp);
  const [{ rows, total, page }, banks, schools] = await Promise.all([listCustomerBanks(user, f, Number(sp.page) || 1), scopedBanks(user), schoolLabels(f.school)]);
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
        <Card title="Ngân hàng" icon={<Landmark size={17} aria-hidden />} meta={`${total} dòng`} pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-semibold tracking-wide text-text-2 uppercase">
                <tr className="border-b border-line">
                  <th scope="col" aria-sort={f.dir === "desc" ? "descending" : "ascending"} className="px-4 py-3 font-semibold whitespace-nowrap">
                    <Link href={`${PATH}?${customerBankFilterQuery({ ...f, dir: nextDir })}`} className="inline-flex items-center gap-1 uppercase hover:text-text">
                      Ngày
                      <span aria-hidden>{f.dir === "desc" ? "↓" : "↑"}</span>
                    </Link>
                  </th>
                  {["Ngân hàng", "Học sinh", "Mã giới thiệu", "Trường", "Trạng thái", "Xác thực ảnh", "Người kiểm"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b border-line align-top last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatShortDateTime(r.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold whitespace-nowrap">
                      <Link href={`/customers/${r.customerId}`} className="text-link hover:underline">
                        {r.bankName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/customers/${r.customerId}`} className="font-semibold text-link hover:underline">
                        {r.fullName}
                      </Link>
                      <span className="block text-xs text-text-3">{r.className}</span>
                    </td>
                    <td className="px-4 py-3 font-mono whitespace-nowrap">{r.referralCode}</td>
                    <td className="px-4 py-3">{r.schoolName}</td>
                    <td className="px-4 py-3">{bankTag(r.status, true)}</td>
                    <td className="px-4 py-3">
                      <CheckCell check={r.check} />
                    </td>
                    <td className="px-4 py-3">{r.reviewer ?? <span className="text-text-3">Chưa kiểm</span>}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-text-3">
                      {filtering ? "Không có dòng nào khớp bộ lọc." : "Chưa có học sinh chọn ngân hàng."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={total} pageSize={PAGE_SIZE} href={(p) => `${PATH}?${customerBankFilterQuery(f, { page: String(p) })}`} />
        </Card>
      </main>
    </>
  );
}
