import { TicketCheck } from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { DataTable, EmptyRow, TableHead } from "@/components/ui/DataTable";
import { ExportButton } from "@/components/ui/ExportButton";
import { FilterChips } from "@/components/ui/FilterChips";
import { Pager } from "@/components/ui/Pager";
import { SearchBox } from "@/components/ui/SearchBox";
import { StatusTag, type Tone } from "@/components/ui/StatusTag";
import { UrlFilters, type FilterDef } from "@/components/ui/UrlFilters";
import { formatDate, formatDateTime } from "@/lib/dates";
import { can, customerScope } from "@/lib/permissions";
import { SMS_STATUS_LABEL, type SmsStatus } from "@/lib/smsFilters";
import { VOUCHER_SMS_STATUSES, voucherFilterQuery, type VoucherFilters } from "@/lib/voucherFilters";
import { requirePage } from "@/server/auth/current";
import { listVouchers, PAGE_SIZE, readVoucherFilters } from "@/server/vouchers";

export const metadata = { title: "Mã voucher" };

const SMS_TONE: Record<SmsStatus, Tone> = { failed: "danger", queued: "progress", sent: "ok" };

export default async function VouchersPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePage("vouchers");
  const sp = await searchParams;
  const { filters: f, banks, schools } = await readVoucherFilters(sp);
  const { rows, total, page } = await listVouchers(user, f, Number(sp.page) || 1);
  const params = Object.fromEntries(new URLSearchParams(voucherFilterQuery({ ...f, q: "" })));
  const without = (patch: Partial<VoucherFilters>) => `/vouchers?${voucherFilterQuery({ ...f, ...patch })}`;
  const day = (v: string) => formatDate(`${v}T00:00:00+07:00`);
  const dateChip = f.from && f.to ? `Ngày cấp: ${day(f.from)} – ${day(f.to)}` : f.from ? `Cấp từ ${day(f.from)}` : f.to ? `Cấp đến ${day(f.to)}` : "";
  const bankNames = f.bank.flatMap((id) => banks.find((b) => b.id === id)?.name ?? []);
  const chips = [
    ...(dateChip ? [{ label: dateChip, href: without({ from: "", to: "" }) }] : []),
    ...(schools.length ? [{ label: `Trường: ${schools.map((s) => s.label).join(", ")}`, href: without({ school: [] }) }] : []),
    ...(bankNames.length ? [{ label: `Ngân hàng đạt: ${bankNames.join(", ")}`, href: without({ bank: [] }) }] : []),
    ...(f.sms ? [{ label: `Tin SMS: ${SMS_STATUS_LABEL[f.sms]}`, href: without({ sms: "" }) }] : []),
  ];
  const defs: FilterDef[] = [
    { kind: "dates", id: "issued", label: "Ngày cấp", fromKey: "from", toKey: "to" },
    { kind: "search", id: "school", label: "Trường", key: "school", url: "/api/admin/vouchers/schools", selected: schools, placeholder: "Gõ để tìm trường…" },
    { kind: "choice", id: "bank", label: "Ngân hàng đạt", key: "bank", multiple: true, options: banks.map((b) => ({ value: b.id, label: b.name })) },
    { kind: "choice", id: "sms", label: "Tin SMS", key: "sms", options: [{ value: "", label: "Mọi trạng thái" }, ...VOUCHER_SMS_STATUSES.map((v) => ({ value: v, label: SMS_STATUS_LABEL[v] }))] },
  ];
  // Hồ sơ chỉ mở được khi người xem thấy mọi hồ sơ; Nhân viên chỉ có quyền voucher thì không có link dẫn tới trang 404.
  const linkNames = customerScope(user).all;

  return (
    <>
      <TopBar
        title="Mã voucher"
        actions={
          <>
            <SearchBox action="/vouchers" placeholder="Mã voucher, họ tên, SĐT phụ huynh…" defaultValue={f.q} hidden={params} />
            <UrlFilters path="/vouchers" params={{ ...params, ...(f.q ? { q: f.q } : {}) }} defs={defs} />
            {can(user, "export_excel") && <ExportButton href={`/api/admin/vouchers/export?${voucherFilterQuery(f)}`} />}
          </>
        }
      />
      <main className="p-6">
        <FilterChips chips={chips} />
        <Card title="Mã voucher" icon={<TicketCheck size={17} aria-hidden />} meta={`${total} mã`}>
          <DataTable caption="Mã voucher, học sinh, trường và ngày cấp">
            <TableHead columns={["Mã voucher", "Họ tên", "Lớp", "Trường", "Phụ huynh", "Ngày cấp", "Tin SMS"]} />
            <tbody>
              {rows.map((v) => (
                <tr key={v.id}>
                  <td className="font-mono">{v.code}</td>
                  <td>
                    {linkNames ? (
                      <Link href={`/customers/${v.customerId}`} className="text-link hover:underline">
                        {v.fullName}
                      </Link>
                    ) : (
                      v.fullName
                    )}
                  </td>
                  <td>{v.className}</td>
                  <td>{v.schoolName}</td>
                  <td>{v.parentName}</td>
                  <td className="tabular-nums">{formatDateTime(v.issuedAt)}</td>
                  <td>{v.smsStatus && <StatusTag tone={SMS_TONE[v.smsStatus]}>{SMS_STATUS_LABEL[v.smsStatus]}</StatusTag>}</td>
                </tr>
              ))}
              {!rows.length && (
                <EmptyRow colSpan={7}>
                  {f.q || chips.length ? "Không có mã khớp bộ lọc." : "Chưa cấp mã voucher nào."}
                </EmptyRow>
              )}
            </tbody>
          </DataTable>
          <Pager page={page} total={total} pageSize={PAGE_SIZE} href={(p) => `/vouchers?${voucherFilterQuery(f, { page: String(p) })}`} />
        </Card>
      </main>
    </>
  );
}
