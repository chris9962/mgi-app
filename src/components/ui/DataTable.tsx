import type { ReactNode } from "react";

export function DataTable({ caption, children }: { caption: string; children: ReactNode }) {
  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        {children}
      </table>
    </div>
  );
}

export function TableHead({ columns }: { columns: string[] }) {
  return (
    <thead>
      <tr>
        {columns.map((h) => (
          <th key={h} scope="col">
            {h}
          </th>
        ))}
      </tr>
    </thead>
  );
}

export function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-[17.6px] text-center text-text-3 mobile:text-left">
        {children}
      </td>
    </tr>
  );
}

export const rowActions = "flex items-center gap-[8.8px]";
export const rowIconButton = "grid size-9 flex-none place-items-center rounded-[10px] border border-line text-text hover:bg-text/7 active:bg-text/14 pointer-coarse:size-11";
