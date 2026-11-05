import { Landmark } from "lucide-react";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { StatusTag } from "@/components/ui/StatusTag";
import { AddBankButton, BankActions } from "@/components/banks/BankActions";
import { BankTabs } from "@/components/banks/BankTabs";
import { can, canManageAnyBank } from "@/lib/permissions";
import { requirePageWhere } from "@/server/auth/current";
import { listBanks } from "@/server/banks";

export const metadata = { title: "Ngân hàng & mã giới thiệu" };

export default async function BanksPage() {
  const user = await requirePageWhere(canManageAnyBank);
  const rows = await listBanks(user);
  const canAssign = can(user, "manage_banks");
  return (
    <>
      <TopBar title="Ngân hàng & mã giới thiệu" actions={canAssign ? <AddBankButton /> : undefined} />
      <main className="p-6">
        <BankTabs current="banks" />
        <Card title="Kho ngân hàng" icon={<Landmark size={17} aria-hidden />} meta={`${rows.length} ngân hàng`} pad={false}>
          <div className="table-scroll">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-semibold tracking-wide text-text-2 uppercase">
                <tr className="border-b border-line">
                  {["Mã ngân hàng", "Tên ngân hàng", "Ưu tiên", "Ảnh cần nộp", "Mã còn chỗ", "Người quản", "Trạng thái", "Thao tác"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((b) => (
                  <tr key={b.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold">{b.code}</td>
                    <td className="px-4 py-3">{b.name}</td>
                    <td className="px-4 py-3 tabular-nums">{b.sortOrder}</td>
                    <td className="px-4 py-3">{b.slotCount ? `${b.slotCount} ảnh` : <span className="text-text-3">Chưa cài</span>}</td>
                    <td className="px-4 py-3 tabular-nums">{b.openCodeCount}</td>
                    <td className="px-4 py-3">{b.managers.length ? b.managers.map((m) => m.fullName).join(", ") : <span className="text-text-3">Chưa giao</span>}</td>
                    <td className="px-4 py-3">{b.active ? <StatusTag tone="ok">Đang triển khai</StatusTag> : <StatusTag tone="neutral">Đã tắt</StatusTag>}</td>
                    <td className="px-4 py-3">
                      <BankActions
                        active={b.active}
                        canAssign={canAssign}
                        bank={{ id: b.id, code: b.code, name: b.name, sortOrder: b.sortOrder, managers: b.managers.map((m) => ({ id: m.id, label: m.fullName })) }}
                      />
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-text-3 mobile:text-left">
                      Chưa có ngân hàng nào.
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
