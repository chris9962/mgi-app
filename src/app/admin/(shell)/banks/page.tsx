import { Landmark } from "lucide-react";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { DataTable, EmptyRow, TableHead } from "@/components/ui/DataTable";
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
        <Card title="Kho ngân hàng" icon={<Landmark size={17} aria-hidden />} meta={`${rows.length} ngân hàng`}>
          <DataTable caption="Ngân hàng, ảnh cần nộp, mã còn chỗ, người quản và trạng thái">
            <TableHead columns={["Mã ngân hàng", "Tên ngân hàng", "Ưu tiên", "Ảnh cần nộp", "Mã còn chỗ", "Người quản", "Trạng thái", "Thao tác"]} />
            <tbody>
              {rows.map((b) => (
                <tr key={b.id}>
                  <td>{b.code}</td>
                  <td>
                    <span className="flex items-center gap-2.5">
                      {b.logoKey ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={`/api/admin/images?key=${encodeURIComponent(b.logoKey)}`} alt="" className="h-8 w-20 max-w-none flex-none rounded-md bg-white object-contain ring-1 ring-line" />
                      ) : (
                        <span aria-hidden className="h-8 w-20 flex-none rounded-md border border-dashed border-line" />
                      )}
                      {b.name}
                    </span>
                  </td>
                  <td className="tabular-nums">{b.sortOrder}</td>
                  <td>{b.slotCount ? `${b.slotCount} ảnh` : <span className="text-text-3">Chưa cài</span>}</td>
                  <td className="tabular-nums">{b.openCodeCount}</td>
                  <td>{b.managers.length ? b.managers.map((m) => m.fullName).join(", ") : <span className="text-text-3">Chưa giao</span>}</td>
                  <td>{b.active ? <StatusTag tone="ok">Đang triển khai</StatusTag> : <StatusTag tone="neutral">Đã tắt</StatusTag>}</td>
                  <td>
                    <BankActions
                      active={b.active}
                      canAssign={canAssign}
                      bank={{ id: b.id, code: b.code, name: b.name, sortOrder: b.sortOrder, logoKey: b.logoKey, hotline: b.hotline, overview: b.overview, managers: b.managers.map((m) => ({ id: m.id, label: m.fullName })) }}
                    />
                  </td>
                </tr>
              ))}
              {!rows.length && (
                <EmptyRow colSpan={8}>
                  Chưa có ngân hàng nào.
                </EmptyRow>
              )}
            </tbody>
          </DataTable>
        </Card>
      </main>
    </>
  );
}
