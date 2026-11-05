import { createHmac } from "node:crypto";
import { removeDiacritics } from "@/lib/text";

// Bỏ 0, O, 1, I, L: phụ huynh đọc mã từ SMS rồi gõ lại trên app PVI.
export const VOUCHER_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export type VoucherInput = { customerId: string; provinceCode: string; wardCode: string; parentName: string; schoolName: string; fullName: string; className: string };

const letters = (s: string) => removeDiacritics(s).toUpperCase().replace(/[^A-Z0-9]/g, "");

// Từ viết hoa toàn bộ như THPT, THCS là chữ viết tắt sẵn nên giữ cả từ; từ khác lấy chữ cái đầu.
export const abbreviate = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => (w.length > 1 && w === w.toUpperCase() && w !== w.toLowerCase() ? letters(w) : letters(w).slice(0, 1)))
    .join("");

export const classPart = (className: string): string => letters(className);

// Ký tự kiểm là HMAC của dữ liệu không in trên mã (id, tỉnh, xã, phụ huynh) và 3 phần chữ: người ngoài không tự tạo được mã hợp lệ.
export function voucherCode(input: VoucherInput, secret: string): string {
  if (!secret) throw new Error("Thiếu VOUCHER_SECRET, không sinh được mã voucher.");
  const parts = [abbreviate(input.schoolName), abbreviate(input.fullName), classPart(input.className)];
  const message = [input.customerId, input.provinceCode, input.wardCode, input.parentName.normalize("NFC").trim(), ...parts].join("\n");
  let n = createHmac("sha256", secret).update(message).digest().readBigUInt64BE(0);
  let check = "";
  for (let i = 0; i < 4; i++) {
    check += VOUCHER_ALPHABET[Number(n % BigInt(VOUCHER_ALPHABET.length))];
    n /= BigInt(VOUCHER_ALPHABET.length);
  }
  return [...parts, check].join("-");
}

// Đọc mỗi lần gọi: thiếu khoá thì nghiệp vụ từ chối cấp voucher thay vì sinh mã bằng khoá rỗng.
export const voucherSecret = (): string | null => process.env.VOUCHER_SECRET || null;
