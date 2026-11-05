import { lineHasName, linesHaveExactCode, nameKey } from "./text";
import type { PhotoCheckItem } from "@/lib/photoCheck";

export type CheckSlot = { slotId: string; slotName: string; checkName: boolean; checkCode: boolean };
export type CheckValues = { fullName: string; referralCode: string };

// Mã chỉ có QR thì dòng ngân hàng không có mã chữ, không có gì để so.
export const partsOf = (slot: CheckSlot, values: CheckValues) => ({ name: slot.checkName, code: slot.checkCode && values.referralCode.trim() !== "" });

// Không trích giá trị trên ảnh để hiện: không thấy thì chỉ nói không tìm thấy giá trị hệ thống, người quản mở ảnh xem.
export function judgeSlot(slot: CheckSlot, lines: string[] | null, values: CheckValues): PhotoCheckItem {
  const parts = partsOf(slot, values);
  const expected = [parts.name && values.fullName, parts.code && values.referralCode].filter(Boolean).join(" - ");
  const base = { slotId: slot.slotId, slotName: slot.slotName, expected };
  if (!lines) return { ...base, passed: false, reason: "Chưa có ảnh." };
  const missing = [
    parts.name && !lines.some((line) => lineHasName(line, nameKey(values.fullName))) && `họ tên ${values.fullName}`,
    parts.code && !linesHaveExactCode(lines, values.referralCode) && `mã giới thiệu ${values.referralCode}`,
  ].filter(Boolean);
  if (missing.length) return { ...base, passed: false, reason: `Không tìm thấy ${missing.join(" và ")} trong ảnh.` };
  return { ...base, passed: true, reason: parts.name && parts.code ? "Họ tên và mã giới thiệu" : parts.name ? "Họ tên" : "Mã giới thiệu" };
}
