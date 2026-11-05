import { randomInt } from "node:crypto";
import { compare, hashSync } from "bcryptjs";

// Bỏ i, l, o, 0, 1 vì mật khẩu được đọc hoặc nhắn qua Zalo. Dùng randomInt vì Math.random đoán được.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generatePassword(): string {
  return Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function hashPassword(password: string): string {
  return hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return compare(password, hash);
}
