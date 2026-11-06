import { MessageSquareWarning } from "lucide-react";
import Link from "next/link";
import { ResendButton } from "@/components/sms/ResendButton";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { FilterChips } from "@/components/ui/FilterChips";
import { Pager } from "@/components/ui/Pager";
import { SearchBox } from "@/components/ui/SearchBox";
import { StatusTag, type Tone } from "@/components/ui/StatusTag";
import { UrlFilters } from "@/components/ui/UrlFilters";
import { formatShortDateTime } from "@/lib/dates";
import { parseSmsFilters, SMS_STATUS_LABEL, smsFilterQuery, type SmsStatus } from "@/lib/smsFilters";
import { formatPhone } from "@/lib/text";
import { requirePage } from "@/server/auth/current";
import { listSms, MAX_ATTEMPTS, PAGE_SIZE } from "@/server/sms/queue";

export const metadata = { title: "Tin SMS lỗi" };

const TONE: Record<SmsStatus, Tone> = { failed: "danger", queued: "progress", sent: "ok" };

export default async function SmsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const user = await requirePage("customers");
  const sp = await searchParams;
  const f = parseSmsFilters(sp);
  const { rows, total, page } = await listSms(user, f, Number(sp.page) || 1);
  const status: Record<string, string> = f.status === "failed" ? {} : { status: f.status };

  return (
    <>
      <TopBar
        title="Tin SMS lỗi"
        actions={
          <>
            <SearchBox action="/sms" placeholder="Họ tên, SĐT…" defaultValue={f.q} hidden={status} />
            <UrlFilters
              path="/sms"
              params={{ status: f.status, ...(f.q ? { q: f.q } : {}) }}
              defs={[
                {
                  kind: "choice",
                  id: "status",
                  label: "Trạng thái",
                  key: "status",
                  none: "all",
                  options: [...Object.entries(SMS_STATUS_LABEL).map(([value, label]) => ({ value, label })), { value: "all", label: "Mọi trạng thái" }],
                },
              ]}
            />
          </>
        }
      />
      <main className="p-6">
        <FilterChips chips={f.status === "all" ? [] : [{ label: `Trạng thái: ${SMS_STATUS_LABEL[f.status]}`, href: `/sms?${smsFilterQuery({ ...f, status: "all" })}` }]} />
        <Card title="Tin SMS" icon={<MessageSquareWarning size={17} aria-hidden />} meta={`${total} tin`} pad={false}>
          <div className="table-scroll">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-semibold tracking-wide text-text-2 uppercase">
                <tr className="border-b border-line">
                  {["Gửi lúc", "Họ tên", "Trường", "SĐT nhận", "Lỗi", "Lần gửi", "Trạng thái", "Thao tác"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatShortDateTime(m.sentAt ?? m.createdAt)}</td>
                    <td className="px-4 py-3 font-semibold">
                      <Link href={`/customers/${m.customerId}`} className="text-link hover:underline">
                        {m.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3">{m.schoolName}</td>
                    <td className="px-4 py-3 whitespace-nowrap tabular-nums">{formatPhone(m.toPhone)}</td>
                    <td className="px-4 py-3">{m.error || <span className="text-text-3">Không có</span>}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {m.attempts}/{MAX_ATTEMPTS}
                    </td>
                    <td className="px-4 py-3">
                      <StatusTag tone={TONE[m.status]}>{SMS_STATUS_LABEL[m.status]}</StatusTag>
                    </td>
                    <td className="px-4 py-3">{m.status === "failed" && <ResendButton id={m.id} fullName={m.fullName} toPhone={m.toPhone} />}</td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-text-3 mobile:text-left">
                      {f.q || (f.status !== "failed" && f.status !== "all") ? "Không có tin khớp bộ lọc." : f.status === "failed" ? "Không có tin lỗi." : "Chưa có tin nào."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={page} total={total} pageSize={PAGE_SIZE} href={(p) => `/sms?${smsFilterQuery(f, { page: String(p) })}`} />
        </Card>
      </main>
    </>
  );
}
