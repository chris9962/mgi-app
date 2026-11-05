import { School } from "lucide-react";
import { TopBar } from "@/components/shell/TopBar";
import { Card } from "@/components/ui/Card";
import { ExportButton } from "@/components/ui/ExportButton";
import { Pager } from "@/components/ui/Pager";
import { SearchBox } from "@/components/ui/SearchBox";
import { StatusTag } from "@/components/ui/StatusTag";
import { AddSchoolButton, SchoolActions } from "@/components/schools/SchoolActions";
import { requirePage } from "@/server/auth/current";
import { listProvinces, listSchools, PAGE_SIZE } from "@/server/schools";
import { studentLink } from "@/lib/links";
import { can } from "@/lib/permissions";

export const metadata = { title: "Trường" };

const shortProvince = (name: string) => name.replace(/^(Tỉnh|Thành phố)\s+/, "");

export default async function SchoolsPage({ searchParams }: { searchParams: Promise<{ q?: string; page?: string }> }) {
  const user = await requirePage("schools");
  const { q = "", page = "1" } = await searchParams;
  const [{ rows, total, page: current }, provinces] = await Promise.all([listSchools({ q, page: Number(page) || 1 }), listProvinces()]);
  const href = (p: number) => `/schools?${new URLSearchParams({ ...(q ? { q } : {}), page: String(p) })}`;

  return (
    <>
      <TopBar
        title="Trường"
        actions={
          <>
            <SearchBox action="/schools" placeholder="Tên trường, xã…" defaultValue={q} />
            {can(user, "export_excel") && <ExportButton href={`/api/admin/schools/export?${new URLSearchParams(q ? { q } : {})}`} />}
            <AddSchoolButton provinces={provinces} />
          </>
        }
      />
      <main className="p-6">
        <Card title="Trường" icon={<School size={17} aria-hidden />} meta={`${total} trường`} pad={false}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs font-semibold tracking-wide text-text-2 uppercase">
                <tr className="border-b border-line">
                  {["Trường", "Địa chỉ", "Người liên hệ", "Hồ sơ", "Đạt ≥ 1", "Trạng thái", "Thao tác"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-3 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="px-4 py-3 font-semibold">{s.name}</td>
                    <td className="px-4 py-3">
                      {s.wardName}, {shortProvince(s.provinceName)}
                    </td>
                    <td className="px-4 py-3">
                      {s.contactName}
                      <span className="block text-xs text-text-3">{s.contactPhone}</span>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{s.customerCount}</td>
                    <td className="px-4 py-3 tabular-nums">{s.passedCount}</td>
                    <td className="px-4 py-3">{s.active ? <StatusTag tone="ok">Đang mở</StatusTag> : <StatusTag tone="neutral">Đã đóng</StatusTag>}</td>
                    <td className="px-4 py-3">
                      <SchoolActions
                        link={studentLink(s.id)}
                        active={s.active}
                        provinces={provinces}
                        school={{ id: s.id, name: s.name, provinceCode: s.provinceCode, wardCode: s.wardCode, contactName: s.contactName, contactPhone: s.contactPhone }}
                      />
                    </td>
                  </tr>
                ))}
                {!rows.length && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-text-3">
                      {q ? "Không có trường khớp từ khoá." : "Chưa có trường nào."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pager page={current} total={total} pageSize={PAGE_SIZE} href={href} />
        </Card>
      </main>
    </>
  );
}
