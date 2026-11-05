import { TicketCheck } from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { Pager } from "@/components/ui/Pager";
import { SearchBox } from "@/components/ui/SearchBox";
import { UrlFilters } from "@/components/ui/UrlFilters";
import { formatDate, formatDateTime } from "@/lib/dates";
import { customerScope } from "@/lib/permissions";
import { parseVoucherFilters, voucherFilterQuery } from "@/lib/voucherFilters";
import { requirePage } from "@/server/auth/current";
import { listVouchers, PAGE_SIZE } from "@/server/vouchers";

export const metadata = { title: "Mã voucher" };

export default async function VouchersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePage("vouchers");
  const sp = await searchParams;
  const f = parseVoucherFilters(sp);
  const { rows, total, page } = await listVouchers(user, f, Number(sp.page) || 1);
  const dates = Object.fromEntries(Object.entries({ from: f.from, to: f.to }).filter(([, v]) => v));
  const day = (v: string) => formatDate(`${v}T00:00:00+07:00`);
  const dateChip = f.from && f.to ? `Ngày cấp: ${day(f.from)} – ${day(f.to)}` : f.from ? `Cấp từ ${day(f.from)}` : f.to ? `Cấp đến ${day(f.to)}` : "";
  // Hồ sơ chỉ mở được khi người xem thấy mọi hồ sơ; Nhân viên chỉ có quyền voucher thì không có link dẫn tới trang 404.
  const linkNames = customerScope(user).all;

  return (
    <>
      <TopBar
        title="Mã voucher"
        actions={
          <>
            <SearchBox action="/vouchers" placeholder="Mã voucher, họ tên…" defaultValue={f.q} hidden={dates} />
            <UrlFilters path="/vouchers" params={{ ...dates, ...(f.q ? { q: f.q } : {}) }} defs={[{ kind: "dates", id: "issued", label: "Ngày cấp", fromKey: "from", toKey: "to" }]} />
          </>
        }
      />
      <main className="p-6">
        <FilterChips chips={dateChip ? [{ label: dateChip, href: `/vouchers?${voucherFilterQuery({ ...f, from: "", to: "" })}` }] : []} />
        <Card title="Mã voucher" icon={<TicketCheck size={17} aria-hidden />} meta={`${total} mã`} pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-semibold tracking-wide text-text-2 uppercase">
                <tr className="border-b border-line">
                  {["Mã voucher", "Họ tên", "Lớp", "Trường", "Phụ huynh", "Ngày cấp"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((v) => (
                  <tr key={v.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-mono font-semibold whitespace-nowrap">{v.code}</td>
                    <td className="px-4 py-3">
                      {linkNames ? (
                        <Link href={`/customers/${v.customerId}`} className="text-link hover:underline">
                          {v.fullName}
                        </Link>
                      ) : (
                        v.fullName
                      )}
                    </td>
                    <td className="px-4 py-3">{v.className}</td>
                    <td className="px-4 py-3">{v.schoolName}</td>
                    <td className="px-4 py-3">{v.parentName}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatDateTime(v.issuedAt)}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-text-3">
                      {f.q || f.from || f.to ? "Không có mã khớp bộ lọc." : "Chưa cấp mã voucher nào."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={total} pageSize={PAGE_SIZE} href={(p) => `/vouchers?${voucherFilterQuery(f, { page: String(p) })}`} />
        </Card>
      </main>
    </>
  );
}
