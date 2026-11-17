import ExcelJS from "exceljs";
import type { Page, TestInfo } from "@playwright/test";
import { apiReview, apiStudent, bankOf, expect, loginAs, note, openMenu, search, test } from "./support";

const VPB = "ZZE2E HS VPBank";
const TPB = "ZZE2E HS TPBank";
const MB = "ZZE2E HS MB";

// Tải file qua nút Xuất Excel, đọc lại bằng ExcelJS: 3 dòng đầu là nhóm, tổng, tên cột; dữ liệu từ dòng 4.
async function exportFile(page: Page, info: TestInfo, total: number) {
  const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Xuất Excel" }).click()]);
  const path = info.outputPath(download.suggestedFilename());
  await download.saveAs(path);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path);
  const ws = wb.worksheets[0];
  const row = (n: number) => (ws.getRow(n).values as ExcelJS.CellValue[]).slice(1).map((v) => String(v ?? ""));
  const groups = [...new Set(row(1).filter(Boolean))];
  const headers = row(3);
  const data = ws.rowCount - 3;
  expect(groups.length).toBeGreaterThan(0);
  expect(headers[0]).toBe("STT");
  expect(Number(row(2)[0])).toBe(total);
  expect(data).toBe(total);
  await note(page, [download.suggestedFilename(), `Tầng 1 (nhóm): ${groups.join(" | ")}`, `Tầng 2 (tổng): ${row(2)[0]} dòng`, `Tầng 3 (cột): ${headers.slice(0, 8).join(", ")}…`, `Dữ liệu: ${data} dòng, trang ghi ${total}`], 4500);
  return { groups, headers, data };
}

const metaCount = async (page: Page, card: string) => Number(/^(\d+)/.exec((await page.getByRole("region", { name: card, exact: true }).getByText(/^\d+ (hồ sơ|dòng|trường|mã)$/).textContent())!)![1]);

test("Flow 9: Xuất Excel ở Trang 3, Trang 5, Trang 12 và trang Ngân hàng: đầu bảng 3 tầng, đúng số dòng", async ({ page }, info) => {
  await loginAs(page, "zz_e2e_admin");
  const one = await apiStudent(page, { fullName: "Xuất Thị Một", className: "11b1", parentPhone: "0977500001" }, [VPB, TPB]);
  const two = await apiStudent(page, { fullName: "Xuất Văn Hai", className: "11b1", parentPhone: "0977500002" }, [VPB, MB]);
  await apiReview(page, bankOf(one, VPB).id, "passed");
  await apiReview(page, bankOf(two, MB).id, "passed");

  await test.step("Trang 3 Hồ sơ học sinh: 2 hồ sơ", async () => {
    await openMenu(page, "Hồ sơ học sinh");
    await search(page, "Họ tên, SĐT phụ huynh…", "xuat");
    expect(await metaCount(page, "Hồ sơ học sinh")).toBe(2);
    const file = await exportFile(page, info, 2);
    expect(file.groups).toEqual(["HỌC SINH", "NGÂN HÀNG 1", "NGÂN HÀNG 2", "VOUCHER"]);
  });

  await test.step("Trang Ngân hàng: mỗi ngân hàng học sinh chọn một dòng, 4 dòng", async () => {
    await openMenu(page, "Ngân hàng", "Nghiệp vụ");
    await search(page, "Họ tên, SĐT phụ huynh…", "xuat");
    expect(await metaCount(page, "Ngân hàng")).toBe(4);
    const file = await exportFile(page, info, 4);
    expect(file.groups).toEqual(["HỌC SINH", "NGÂN HÀNG"]);
  });

  await test.step("Trang 12 Mã voucher: 2 mã", async () => {
    await openMenu(page, "Mã voucher");
    await search(page, "Mã voucher, họ tên…", "xuat");
    expect(await metaCount(page, "Mã voucher")).toBe(2);
    const file = await exportFile(page, info, 2);
    expect(file.groups).toEqual(["VOUCHER", "HỌC SINH"]);
  });

  await test.step("Trang 5 Trường: các trường e2e", async () => {
    await openMenu(page, "Trường");
    await search(page, "Tên trường, xã…", "ZZE2E");
    const total = await metaCount(page, "Trường");
    expect(total).toBeGreaterThan(0);
    const file = await exportFile(page, info, total);
    expect(file.groups).toEqual(["TRƯỜNG", "HỒ SƠ HỌC SINH"]);
  });
});
