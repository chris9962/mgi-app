import { removeDiacritics } from "@/lib/text";

// Chép từ mgst-app src/server/ocr/text.ts: tìm giá trị hệ thống trong chữ OCR, không dung sai.

export const letterWords = (s: string): string[] =>
  removeDiacritics(s)
    .toUpperCase()
    .replace(/[^A-Z]+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean);

export const nameKey = (fullName: string): string => letterWords(fullName).join("");

// OCR hay dính từ ("TO THICAM HON") và đọc logo, biểu tượng thành chữ ở mép dòng, nên bỏ khoảng trắng và cho dư 2 chữ cái mỗi đầu.
// Lời nhắn chuyển khoản app tự điền "<tên> chuyen tien" nên tên nối liền CHUYENTIEN cũng tính.
export function lineHasName(line: string, expected: string): boolean {
  if (!expected) return false;
  const letters = letterWords(line).join("");
  if (letters.includes(expected + "CHUYENTIEN")) return true;
  if (letters.length < expected.length) return false;
  for (let at = letters.indexOf(expected); at >= 0; at = letters.indexOf(expected, at + 1)) {
    if (at <= 2 && letters.length - at - expected.length <= 2) return true;
  }
  return false;
}

const exactText = (s: string): string => removeDiacritics(s).trim().toUpperCase();

// Hai mã khác nhau một ký tự là mã của hai người: không gộp O/0, I/1, không ghép cụm; AT1050 không chứa mã AT105.
export function linesHaveExactCode(lines: string[], code: string): boolean {
  const expected = exactText(code);
  if (!expected) return false;
  const isAlnum = (c: string | undefined) => c !== undefined && /[A-Z0-9]/.test(c);
  return lines.some((line) => {
    const text = exactText(line);
    for (let at = text.indexOf(expected); at >= 0; at = text.indexOf(expected, at + 1)) {
      if (!isAlnum(text[at - 1]) && !isAlnum(text[at + expected.length])) return true;
    }
    return false;
  });
}
