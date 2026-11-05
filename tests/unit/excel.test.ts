import { describe, expect, test } from "bun:test";
import ExcelJS from "exceljs";
import { buildExcel, EXCEL_GROUP_COLORS, type ExcelColumn } from "../../src/lib/excel";

type Row = { name: string; phone: string; passed: number };
const columns: ExcelColumn<Row>[] = [
  { header: "STT", group: "HỌC SINH", groupColor: EXCEL_GROUP_COLORS.customer, width: 6, value: (_, i) => i + 1, total: (rows) => rows.length },
  { header: "HỌ TÊN", group: "HỌC SINH", groupColor: EXCEL_GROUP_COLORS.customer, transform: "name", value: (r) => r.name },
  { header: "SĐT PHỤ HUYNH", group: "HỌC SINH", groupColor: EXCEL_GROUP_COLORS.customer, type: "text", value: (r) => r.phone },
  { header: "ĐẠT", group: "NGÂN HÀNG", groupColor: EXCEL_GROUP_COLORS.account, align: "center", value: (r) => r.passed, total: (rows) => rows.reduce((n, r) => n + r.passed, 0) },
];

async function read(rows: Row[]) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load((await buildExcel({ sheetName: "Hồ sơ 11/2026", columns, rows })) as unknown as ArrayBuffer);
  return wb.worksheets[0];
}

describe("file Excel đầu bảng 3 tầng", () => {
  test("dòng nhóm gộp ô, dòng tổng, dòng tên cột, rồi dữ liệu", async () => {
    const ws = await read([
      { name: "Trần Minh Anh", phone: "0987654321", passed: 1 },
      { name: "Đỗ Văn Đức", phone: "0912000111", passed: 0 },
    ]);
    expect(ws.name).toBe("Hồ sơ 11-2026");
    expect(ws.getRow(1).values).toEqual([, "HỌC SINH", "HỌC SINH", "HỌC SINH", "NGÂN HÀNG"]);
    expect(ws.getCell("A1").isMerged && ws.getCell("C1").isMerged).toBe(true);
    expect(ws.getRow(2).getCell(1).value).toBe(2);
    expect(ws.getRow(2).getCell(4).value).toBe(1);
    expect(ws.getRow(3).values).toEqual([, "STT", "HỌ TÊN", "SĐT PHỤ HUYNH", "ĐẠT"]);
    expect(ws.getRow(4).values).toEqual([, 1, "TRAN MINH ANH", "0987654321", 1]);
    expect(ws.getRow(5).getCell(2).value).toBe("DO VAN DUC");
  });

  test("SĐT giữ số 0 đầu: ô là chuỗi, cột định dạng text", async () => {
    const ws = await read([{ name: "A", phone: "0987654321", passed: 0 }]);
    expect(typeof ws.getCell("C4").value).toBe("string");
    expect(ws.getColumn(3).numFmt).toBe("@");
  });

  test("khoá 3 dòng đầu, 2 cột đầu và bật bộ lọc ở dòng tên cột", async () => {
    const ws = await read([{ name: "A", phone: "0987654321", passed: 0 }]);
    expect(ws.views[0]).toMatchObject({ state: "frozen", xSplit: 2, ySplit: 3 });
    expect(ws.autoFilter).toBeTruthy();
  });
});
