import { Cpu, Images } from "lucide-react";
import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/ops/AutoRefresh";
import { ResourceCell } from "@/components/ops/ResourceCell";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/dates";
import { formatBytes, formatCount, OPS_PHOTO_CHECK_DAYS, resourcePercent } from "@/lib/ops";
import { requirePage } from "@/server/auth/current";
import { opsSummary, type HostSnapshot } from "@/server/ops";

export const metadata = { title: "Vận hành hệ thống" };

function HostCells({ host }: { host: HostSnapshot }) {
  const cpu = Math.round(host.cpuPercent);
  const s3 = host.s3;
  const s3Percent = s3 ? resourcePercent(s3.bytes, host.s3QuotaBytes) : null;
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <ResourceCell label="CPU" percent={cpu} details={[`${cpu}% trong một phút`]} />
      <ResourceCell label="RAM" percent={resourcePercent(host.ramUsed, host.ramTotal)} details={[`${formatBytes(host.ramUsed)} / ${formatBytes(host.ramTotal)}`]} />
      <ResourceCell label="Ổ đĩa" percent={resourcePercent(host.diskUsed, host.diskTotal)} details={[`${formatBytes(host.diskUsed)} / ${formatBytes(host.diskTotal)}`]} />
      <ResourceCell
        label="S3"
        percent={s3Percent}
        value={s3 ? formatBytes(s3.bytes) : "Chưa đo"}
        details={s3 ? [...(host.s3QuotaBytes > 0 ? [`${formatBytes(s3.bytes)} / ${formatBytes(host.s3QuotaBytes)}`] : []), `${formatCount(s3.objects)} tệp - đo lúc ${formatDateTime(s3.at)}`] : []}
      />
    </div>
  );
}

export default async function OpsPage() {
  const user = await requirePage("system");
  const r = await opsSummary(user);
  if (!r.ok) notFound();
  const { host, photoCheck } = r;

  return (
    <>
      <AutoRefresh seconds={60} />
      <TopBar title="Vận hành hệ thống" />
      <main className="grid gap-5 p-6">
        <Card title="Máy chủ" icon={<Cpu size={17} aria-hidden />} meta={host ? `Đo lúc ${formatDateTime(host.at)}` : "Chưa có số đo"}>
          {host ? <HostCells host={host} /> : <p className="text-sm text-text-3">Chưa có số đo.</p>}
        </Card>

        <Card title="Kiểm ảnh" icon={<Images size={17} aria-hidden />} meta={`${formatCount(photoCheck.pending)} lượt đang đợi`}>
          <div className="mb-3.5 grid gap-3 sm:grid-cols-2">
            <div className="grid gap-1.5 rounded-xl border border-line bg-card px-3.5 py-3">
              <b className="text-xl font-semibold tabular-nums">{formatCount(photoCheck.pending)}</b>
              <span className="text-[13px] text-text-2">Đang đợi kiểm</span>
            </div>
            <div className="grid gap-1.5 rounded-xl border border-line bg-card px-3.5 py-3">
              <b className="text-xl font-semibold tabular-nums">{photoCheck.oldestPendingAt ? formatDateTime(photoCheck.oldestPendingAt) : "Không có"}</b>
              <span className="text-[13px] text-text-2">Lượt đợi lâu nhất</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="sr-only">Kết quả kiểm ảnh theo ngân hàng trong {OPS_PHOTO_CHECK_DAYS} ngày</caption>
              <thead className="text-xs font-semibold tracking-wide text-text-2 uppercase">
                <tr className="border-b border-line">
                  {["Ngân hàng", "Đang đợi", "Đạt", "Không đạt", "Lỗi kiểm"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {photoCheck.banks.map((b) => (
                  <tr key={b.bankId} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold">{b.name}</td>
                    {[b.pending, b.passed, b.failed, b.error].map((n, i) => (
                      <td key={i} className="px-4 py-3 tabular-nums">
                        {formatCount(n)}
                      </td>
                    ))}
                  </tr>
                ))}
                {!photoCheck.banks.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-text-3">
                      Chưa có lượt kiểm nào trong {OPS_PHOTO_CHECK_DAYS} ngày.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </main>
    </>
  );
}
