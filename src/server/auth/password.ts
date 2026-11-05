import { randomInt } from "node:crypto";
import { compare, hash } from "bcryptjs";

// Bỏ i, l, o, 0, 1 vì mật khẩu được đọc hoặc nhắn qua Zalo. Dùng randomInt vì Math.random đoán được.
const ALPHABET = "abcdefghjkmnpqrstuvwxyz23456789";

export function generatePassword(): string {
  return Array.from({ length: 10 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
}

export function hashPassword(password: string): Promise<string> {
  return hash(password, 10);
}

export function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  return compare(password, passwordHash);
}
