import { desc, isNotNull, lt, sql } from "drizzle-orm";
import { db } from "./db/client";
import { hostMetrics, sessions } from "./db/schema";
import { can } from "@/lib/permissions";
import { OPS_PHOTO_CHECK_DAYS } from "@/lib/ops";
import type { SessionUser } from "@/lib/types";
import type { Usage } from "./hostProbe";

export type HostSnapshot = {
  at: Date;
  cpuPercent: number;
  ramUsed: number;
  ramTotal: number;
  diskUsed: number;
  diskTotal: number;
  s3: { bytes: number; objects: number; at: Date } | null;
  s3QuotaBytes: number;
};

export type BankCheckRow = { bankId: string; name: string; pending: number; passed: number; failed: number; error: number };

export type OpsSummary = { host: HostSnapshot | null; photoCheck: { pending: number; oldestPendingAt: Date | null; banks: BankCheckRow[] } };

// Hạn mức bucket đọc ở app vì ô S3 hiện "đã dùng / tổng"; ops-watch không cần nó khi không gửi cảnh báo.
const s3QuotaBytes = () => Math.max(0, Number(process.env.S3_QUOTA_GB) || 0) * 1024 ** 3;

async function hostSnapshot(): Promise<HostSnapshot | null> {
  const [latest] = await db.select().from(hostMetrics).orderBy(desc(hostMetrics.at)).limit(1);
  if (!latest) return null;
  // S3 đo mỗi giờ nên dòng mới nhất thường để trống S3: lấy lượt đo S3 gần nhất.
  const [s3] = await db
    .select({ bytes: hostMetrics.s3Bytes, objects: hostMetrics.s3Objects, at: hostMetrics.s3At })
    .from(hostMetrics)
    .where(isNotNull(hostMetrics.s3At))
    .orderBy(desc(hostMetrics.at))
    .limit(1);
  return {
    at: latest.at,
    cpuPercent: Number(latest.cpuPercent),
    ramUsed: latest.ramUsed,
    ramTotal: latest.ramTotal,
    diskUsed: latest.diskUsed,
    diskTotal: latest.diskTotal,
    s3: s3?.at ? { bytes: s3.bytes ?? 0, objects: s3.objects ?? 0, at: s3.at } : null,
    s3QuotaBytes: s3QuotaBytes(),
  };
}

// Chép luật của mgst-app: mỗi dòng ngân hàng chỉ tính lượt mới nhất, kiểm lại đạt thì lượt cũ không còn nằm ở cột Không đạt.
// Đang đợi không kẹp theo ngày: lượt kẹt từ tuần trước vẫn phải hiện. N ngày là N ngày lịch giờ Việt Nam tính cả hôm nay.
async function photoCheckStats(days: number): Promise<OpsSummary["photoCheck"]> {
  const since = sql`(date_trunc('day', now() at time zone 'Asia/Ho_Chi_Minh') - ${`${days - 1} days`}::interval) at time zone 'Asia/Ho_Chi_Minh'`;
  const rows = await db.execute<{ bank_id: string; name: string; pending: string; passed: string; failed: string; error: string }>(sql`
    with latest as (
      select distinct on (c.customer_bank_id) c.customer_bank_id, c.status, c.passed, c.total
      from photo_checks c
      where c.status = 'pending' or c.created_at >= ${since}
      order by c.customer_bank_id, c.created_at desc
    )
    select b.id as bank_id, b.name,
      count(*) filter (where l.status = 'pending') as pending,
      count(*) filter (where l.status = 'done' and l.total > 0 and l.passed = l.total) as passed,
      count(*) filter (where l.status = 'done' and l.passed < l.total) as failed,
      count(*) filter (where l.status = 'failed') as error
    from latest l
    join customer_banks cb on cb.id = l.customer_bank_id
    join banks b on b.id = cb.bank_id
    group by b.id, b.name, b.sort_order
    order by b.sort_order, b.name
  `);
  const [queue] = (await db.execute<{ pending: string; oldest: Date | string | null }>(sql`select count(*) as pending, min(created_at) as oldest from photo_checks where status = 'pending'`)).rows;
  return {
    pending: Number(queue?.pending ?? 0),
    oldestPendingAt: queue?.oldest ? new Date(queue.oldest) : null,
    banks: rows.rows.map((r) => ({ bankId: r.bank_id, name: r.name, pending: Number(r.pending), passed: Number(r.passed), failed: Number(r.failed), error: Number(r.error) })),
  };
}

export async function opsSummary(actor: SessionUser): Promise<({ ok: true } & OpsSummary) | { ok: false; message: string; status: 404 }> {
  if (!can(actor, "system")) return { ok: false, message: "Không tìm thấy.", status: 404 };
  const [host, photoCheck] = await Promise.all([hostSnapshot(), photoCheckStats(OPS_PHOTO_CHECK_DAYS)]);
  return { ok: true, host, photoCheck };
}

export async function recordHostMetrics(m: { cpuPercent: number; ram: Usage; disk: Usage; s3: { bytes: number; objects: number } | null }): Promise<number> {
  const [row] = await db
    .insert(hostMetrics)
    .values({
      cpuPercent: m.cpuPercent.toFixed(2),
      ramUsed: m.ram.used,
      ramTotal: m.ram.total,
      diskUsed: m.disk.used,
      diskTotal: m.disk.total,
      s3Bytes: m.s3?.bytes ?? null,
      s3Objects: m.s3?.objects ?? null,
      s3At: m.s3 ? new Date() : null,
    })
    .returning({ id: hostMetrics.id });
  return row.id;
}

// Bảng số đo chỉ để nhìn hiện tại; phiên hết hạn không dùng được nữa mà bảng sessions lớn dần nếu không dọn.
export async function cleanupOps(keepDays = 7): Promise<{ metrics: number; sessions: number }> {
  const metrics = await db.delete(hostMetrics).where(lt(hostMetrics.at, sql`now() - ${`${keepDays} days`}::interval`)).returning({ id: hostMetrics.id });
  const expired = await db.delete(sessions).where(lt(sessions.expiresAt, sql`now()`)).returning({ id: sessions.id });
  return { metrics: metrics.length, sessions: expired.length };
}
