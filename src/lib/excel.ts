import ExcelJS from "exceljs";
import { nameForExcel } from "./text";

// Chép từ src/lib/excel.ts của mgst-app (chuẩn mục 12 AGENTS.md mgst-app). Khác bản gốc: dựng file ở máy chủ, trả bytes cho route tải về.

// Arial có trên cả Windows lẫn macOS.
const FONT = "Arial";

export type ExcelColumn<T> = {
  header: string;
  width?: number;
  // text ép định dạng chuỗi: Excel cắt số 0 đầu của SĐT nếu để số.
  type?: "text" | "number" | "auto";
  // name: VIẾT HOA BỎ DẤU khi xuất.
  transform?: "name";
  // Cột liền nhau cùng nhãn nhóm được gộp ô ở dòng đầu.
  group?: string;
  groupColor?: string;
  // Nhận trọn danh sách dòng, ghi vào dòng tổng.
  total?: (rows: T[]) => string | number;
  align?: "left" | "center";
  value: (row: T, index: number) => string | number;
  link?: (row: T) => string;
  highlight?: (row: T) => boolean;
};

// Bộ màu của file "TÍNH ĐIỂM TỔNG" bên mgst-app: chọn theo nghĩa của nhóm, không tự đặt mã màu mới.
export const EXCEL_GROUP_COLORS = {
  customer: "FFDCE9F7",
  account: "FFDFF0E0",
  app: "FFFDF2D5",
  gift: "FFF6E2F0",
  insurance: "FFE6E2F6",
  staff: "FFEDEEF0",
  points: "FFFBE0DC",
} as const;

const HEADER_GREY = "FFE8EAED";
const TOTAL_GREY = "FFF5F6F7";
const LINE = "FFB0B4BA";
const LINK_BLUE = "FF0563C1";
const HIGHLIGHT_RED = "FFFAD4D4";

const thinBorder = {
  top: { style: "thin" as const, color: { argb: LINE } },
  left: { style: "thin" as const, color: { argb: LINE } },
  bottom: { style: "thin" as const, color: { argb: LINE } },
  right: { style: "thin" as const, color: { argb: LINE } },
};

export type ExcelSheet<T> = { sheetName: string; columns: ExcelColumn<T>[]; rows: T[] };

export const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function buildExcel<T>(sheet: ExcelSheet<T>): Promise<Uint8Array> {
  const wb = new ExcelJS.Workbook();
  addSheet(wb, sheet);
  return new Uint8Array(await wb.xlsx.writeBuffer());
}

function addSheet<T>(wb: ExcelJS.Workbook, { sheetName, columns, rows }: ExcelSheet<T>): void {
  // Excel cấm * ? : \ / [ ] trong tên sheet và giới hạn 31 ký tự; "Tháng 7/2026" làm hỏng cả file.
  const ws = wb.addWorksheet(sheetName.replace(/[*?:\\/[\]]/g, "-").slice(0, 31) || "Sheet1");

  // Đầu bảng 3 tầng khi có cột khai group hoặc total: dòng nhóm, dòng tổng, dòng tên cột.
  const stacked = columns.some((c) => c.group || c.total);
  const headerRow = stacked ? 3 : 1;

  // Không đặt key cho cột: ExcelJS lập chỉ mục theo key, tên cột lặp lại thì cột sau ghi đè cột trước.
  ws.columns = columns.map((c) => ({ width: c.width ?? 18 }));

  // Định dạng mức cột phải đặt trước khi dựng đầu bảng: đặt sau thì ba dòng đầu mất chữ đậm và căn giữa.
  columns.forEach((c, i) => {
    const col = ws.getColumn(i + 1);
    col.font = { name: FONT, size: 10 };
    col.alignment = { horizontal: c.align === "center" ? "center" : "left" };
    if (c.type === "text") col.numFmt = "@";
  });

  if (stacked) {
    const groupRow = ws.addRow(columns.map((c) => c.group ?? ""));
    const totalRow = ws.addRow(columns.map((c) => c.total?.(rows) ?? ""));
    groupRow.height = 22;

    columns.forEach((c, i) => {
      const fill = c.groupColor ?? HEADER_GREY;
      const g = groupRow.getCell(i + 1);
      g.fill = { type: "pattern", pattern: "solid", fgColor: { argb: fill } };
      g.font = { name: FONT, bold: true, size: 11 };
      g.alignment = { horizontal: "center", vertical: "middle" };
      g.border = thinBorder;

      const t = totalRow.getCell(i + 1);
      t.fill = { type: "pattern", pattern: "solid", fgColor: { argb: TOTAL_GREY } };
      t.font = { name: FONT, bold: true, size: 9, color: { argb: "FF5F6368" } };
      t.alignment = { horizontal: c.align === "center" ? "center" : "left" };
      t.border = thinBorder;
    });

    // Gộp ô cho từng dải cột liền nhau cùng nhãn nhóm, để người đọc thấy ranh giới nhóm.
    let start = 0;
    for (let i = 1; i <= columns.length; i += 1)
      if (i === columns.length || columns[i].group !== columns[start].group) {
        if (columns[start].group && i - start > 1) ws.mergeCells(1, start + 1, 1, i);
        start = i;
      }
  }

  const head = ws.addRow(columns.map((c) => c.header));
  head.height = stacked ? 34 : 18;
  columns.forEach((c, i) => {
    const cell = head.getCell(i + 1);
    cell.font = { name: FONT, bold: true, size: 10 };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: stacked };
    if (stacked) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: c.groupColor ?? HEADER_GREY } };
      cell.border = thinBorder;
    }
  });

  for (const [index, row] of rows.entries()) {
    const cells = columns.map((c) => {
      const raw = c.value(row, index);
      if (c.transform === "name") return nameForExcel(String(raw));
      // Ép chuỗi trước khi ghi: numFmt mức cột chỉ đổi cách hiện, giá trị số vẫn mất số 0 đầu.
      return c.type === "text" ? String(raw ?? "") : raw;
    });
    const added = ws.addRow(cells);

    // Gắn địa chỉ sau khi ghi dòng: addRow nhận giá trị thường, ô bấm được cần dạng { text, hyperlink }.
    columns.forEach((c, i) => {
      if (c.highlight?.(row)) added.getCell(i + 1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: HIGHLIGHT_RED } };
      const href = c.link?.(row);
      if (!href) return;
      const cell = added.getCell(i + 1);
      cell.value = { text: String(cell.value ?? ""), hyperlink: href };
      cell.font = { name: FONT, size: 10, color: { argb: LINK_BLUE }, underline: true };
    });
  }

  if (stacked) {
    // Giữ ba dòng đầu và hai cột đầu khi cuộn: cuộn ngang vẫn thấy tên học sinh, cuộn dọc vẫn thấy tên cột.
    ws.views = [{ state: "frozen", xSplit: 2, ySplit: headerRow }];
    ws.autoFilter = { from: { row: headerRow, column: 1 }, to: { row: headerRow + rows.length, column: columns.length } };
  } else {
    ws.getRow(1).font = { name: FONT, bold: true, size: 10 };
  }
}
