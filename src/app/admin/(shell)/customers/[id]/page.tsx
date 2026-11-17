import { Gift, Landmark, MessageSquareText, ScanText, UserRound } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CustomerEditButton } from "@/components/customers/CustomerEditButton";
import { GiftPaidButton } from "@/components/customers/GiftPaidButton";
import { NoteButton, ReviewActions } from "@/components/customers/ReviewActions";
import { bankTag, customerTag } from "@/components/customers/customerView";
import { TopBar } from "@/components/shell/TopBar";
import { BackLink } from "@/components/ui/BackLink";
import { Card } from "@/components/ui/Card";
import { StatusTag } from "@/components/ui/StatusTag";
import { formatDateTime } from "@/lib/dates";
import { can } from "@/lib/permissions";
import { formatPhone } from "@/lib/text";
import { requirePage } from "@/server/auth/current";
import { getCustomerDetail, type CustomerDetail, type DetailBank } from "@/server/customerDetail";
import { isUuid } from "@/server/http/responses";

export const metadata = { title: "Chi tiết hồ sơ" };

const muted = (text: string) => <span className="text-text-3">{text}</span>;

function InfoList({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
      {items.map(([k, v]) => (
        <div key={k} className="flex flex-col gap-0.5">
          <dt className="text-[13px] text-text-2">{k}</dt>
          <dd className="text-sm">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function PhotoCheck({ check }: { check: NonNullable<DetailBank["check"]> }) {
  return (
    <section aria-label="Xác thực ảnh" className="flex flex-col gap-2">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <ScanText size={16} aria-hidden className="text-accent" />
        Xác thực ảnh
        {check.checkedAt && <span className="text-[13px] font-normal text-text-3 tabular-nums">{formatDateTime(check.checkedAt)}</span>}
      </h3>
      {check.status === "pending" ? (
        <p className="text-sm text-text-3">Đang kiểm</p>
      ) : check.status === "failed" ? (
        <p className="text-sm">
          <StatusTag tone="neutral">Không kiểm được</StatusTag> <span className="text-text-2">{check.error}</span>
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {check.items.map((item, i) => (
            <li key={`${item.slotId}-${i}`} className="flex items-start gap-3 rounded-xl border border-line p-3 text-sm">
              {item.passed ? <StatusTag tone="ok">Đạt</StatusTag> : <StatusTag tone="warn">Không đạt</StatusTag>}
              <div className="flex flex-col gap-0.5">
                <b className="font-semibold">{item.slotName}</b>
                <span className="text-text-2">{item.reason}</span>
                <span className="text-text-2">
                  Hệ thống: <b className="font-semibold text-text">{item.expected}</b>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function BankCard({ bank, customer }: { bank: DetailBank; customer: CustomerDetail }) {
  const actionBank = { id: bank.id, name: bank.name, status: bank.status, note: bank.note, slots: bank.slots.filter((s) => !s.removed).map((s) => ({ id: s.id, name: s.name })), photos: bank.photos.map((ph) => ph.id) };
  const meta = [`Ngân hàng ${bank.slot}`, bank.referralCode && `Mã giới thiệu ${bank.referralCode}`, bank.managers.length && `Người quản ${bank.managers.join(", ")}`].filter(Boolean).join(" - ");
  return (
    <Card title={bank.name} icon={<Landmark size={17} aria-hidden />} meta={meta} action={bankTag(bank.status, true)}>
      {bank.managed && (
        <div className="flex flex-col gap-5">
          <ul className="grid gap-3 sm:grid-cols-[repeat(auto-fill,minmax(180px,1fr))]">
            {bank.slots.map((s) => (
              <li key={s.id}>
                <figure className="flex flex-col gap-1.5">
                  <figcaption className="text-[13px] text-text-2">{s.name}</figcaption>
                  {s.photo ? (
                    <a href={`/api/admin/photos/${s.photo.id}`} target="_blank" rel="noopener" className="block overflow-hidden rounded-xl border border-line bg-surface">
                      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh đi qua route kiểm quyền và ghi audit rồi chuyển sang link S3 có hạn, next/image không tải được */}
                      <img src={`/api/admin/photos/${s.photo.id}`} alt={`${s.name} của ${customer.fullName}`} className="h-48 w-full object-contain" />
                    </a>
                  ) : (
                    <span className="grid h-48 place-items-center rounded-xl border border-dashed border-line text-sm text-text-3">Chưa có ảnh</span>
                  )}
                  {s.photo?.uploadedBy && <span className="text-xs text-text-3">Ảnh thay thế của {s.photo.uploadedBy}</span>}
                </figure>
              </li>
            ))}
          </ul>
          {bank.check && <PhotoCheck check={bank.check} />}
          <section aria-label="Ghi chú nội bộ" className="flex flex-col gap-1.5">
            <h3 className="flex items-center gap-1 text-sm font-semibold">
              Ghi chú nội bộ
              <NoteButton bank={actionBank} />
            </h3>
            <p className="rounded-xl bg-panel px-3 py-2.5 text-sm whitespace-pre-line">{bank.note || muted("Chưa có ghi chú")}</p>
          </section>
          {bank.reviewer && bank.reviewedAt && (
            <p className="text-[13px] text-text-2">
              {bank.reviewer} đánh dấu lúc {formatDateTime(bank.reviewedAt)}
            </p>
          )}
          <ReviewActions bank={actionBank} />
        </div>
      )}
    </Card>
  );
}

const SMS_TAG = {
  queued: <StatusTag tone="progress">Đang gửi</StatusTag>,
  sent: <StatusTag tone="ok">Đã gửi</StatusTag>,
  failed: <StatusTag tone="danger">Lỗi</StatusTag>,
};

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePage("customers");
  const { id } = await params;
  const c = isUuid(id) ? await getCustomerDetail(user, id) : null;
  if (!c) notFound();

  const info: [string, React.ReactNode][] = [
    ["Họ tên", c.fullName],
    ["Lớp", c.className],
    ["Trường", c.schoolName],
    [
      "SĐT phụ huynh",
      <a key="pp" href={`tel:${c.parentPhone}`} className="text-link tabular-nums hover:underline" aria-label={`Gọi ${formatPhone(c.parentPhone)}`}>
        {formatPhone(c.parentPhone)}
      </a>,
    ],
    ["Đã có TK", c.existingBanks.length ? c.existingBanks.join(", ") : muted("Không có")],
    [
      "Hồ sơ trùng",
      c.duplicates.length ? (
        <span key="d" className="flex flex-wrap gap-x-2">
          {c.duplicates.map((d) => (
            <Link key={d.id} href={`/customers/${d.id}`} className="text-link hover:underline">
              {d.fullName} - {d.schoolName}
            </Link>
          ))}
        </span>
      ) : (
        muted("Không có hồ sơ cùng tên và SĐT phụ huynh")
      ),
    ],
    ["Gửi lúc", c.submittedAt ? <span className="tabular-nums">{formatDateTime(c.submittedAt)}</span> : muted("Chưa gửi")],
    ["Mở web lần cuối", c.lastSeenAt ? <span className="tabular-nums">{formatDateTime(c.lastSeenAt)}</span> : muted("Chưa có")],
  ];

  return (
    <>
      <TopBar title={c.fullName} />
      {/* Họ tên, phụ huynh, ghi chú không dấu cách vẫn xuống dòng, không đẩy trang cuộn ngang. */}
      <main className="flex flex-col gap-4 p-6 wrap-anywhere">
        <BackLink href="/customers">Hồ sơ học sinh</BackLink>
        <Card title="Thông tin" icon={<UserRound size={17} aria-hidden />} action={customerTag(c.status)}>
          <InfoList items={info} />
          {c.canEdit && (
            <div className="mt-4 flex justify-end border-t border-line pt-4">
              <CustomerEditButton customer={{ id: c.id, fullName: c.fullName, className: c.className, parentPhone: c.parentPhone }} />
            </div>
          )}
        </Card>
        {c.banks.map((b) => (
          <BankCard key={b.id} bank={b} customer={c} />
        ))}
        <Card
          title="Quà 20.000 đồng"
          icon={<Gift size={17} aria-hidden />}
          meta="Từ ngân hàng thứ hai"
          action={
            c.gift.claim?.paidAt ? <StatusTag tone="ok">Đã chuyển</StatusTag> : c.gift.claim ? <StatusTag tone="progress">Chờ chuyển</StatusTag> : c.gift.eligible ? <StatusTag tone="warn">Chưa nhập tài khoản</StatusTag> : <StatusTag tone="neutral">Chưa đủ 2 ngân hàng</StatusTag>
          }
        >
          {c.gift.claim && (
            <div className="flex flex-col gap-4">
              <InfoList
                items={[
                  ["Ngân hàng nhận", c.gift.claim.bankName],
                  ["Số tài khoản", <span key="n" className="font-mono font-semibold">{c.gift.claim.accountNumber}</span>],
                  ["Chủ tài khoản", c.gift.claim.accountName],
                  ["Khai lúc", formatDateTime(c.gift.claim.createdAt)],
                  ...(c.gift.claim.paidAt ? ([["Chuyển lúc", `${formatDateTime(c.gift.claim.paidAt)}${c.gift.claim.paidBy ? ` bởi ${c.gift.claim.paidBy}` : ""}`]] as [string, React.ReactNode][]) : []),
                ]}
              />
              {!c.gift.claim.paidAt && can(user, "vouchers") && (
                <div className="flex justify-end">
                  <GiftPaidButton customerId={c.id} fullName={c.fullName} />
                </div>
              )}
            </div>
          )}
        </Card>
        <Card title="SMS cho phụ huynh" icon={<MessageSquareText size={17} aria-hidden />} action={c.sms ? SMS_TAG[c.sms.status] : <StatusTag tone="neutral">Chưa gửi</StatusTag>}>
          {(c.voucher || c.sms) && (
            <InfoList
              items={[
                ...(c.voucher ? ([["Mã voucher", <b key="v" className="font-mono font-semibold">{c.voucher.code}</b>], ["Ngày cấp", formatDateTime(c.voucher.issuedAt)]] as [string, React.ReactNode][]) : []),
                ...(c.sms
                  ? ([
                      ["Gửi tới", <span key="t" className="tabular-nums">{formatPhone(c.sms.toPhone)}</span>],
                      ["Gửi lúc", c.sms.sentAt ? formatDateTime(c.sms.sentAt) : muted(`Lần gửi ${c.sms.attempts}/3`)],
                      ...(c.sms.error ? [["Lỗi", c.sms.error]] : []),
                    ] as [string, React.ReactNode][])
                  : []),
              ]}
            />
          )}
        </Card>
      </main>
    </>
  );
}
