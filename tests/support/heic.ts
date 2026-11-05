import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// sips của macOS ghi được HEIC (sharp và heic-convert chỉ đọc); máy không có sips thì trả null để test bỏ qua.
export function toHeic(png: Uint8Array): Uint8Array | null {
  if (!existsSync("/usr/bin/sips")) return null;
  const dir = mkdtempSync(join(tmpdir(), "mgi-heic-"));
  try {
    writeFileSync(join(dir, "a.png"), png);
    execFileSync("/usr/bin/sips", ["-s", "format", "heic", join(dir, "a.png"), "--out", join(dir, "a.heic")], { stdio: "ignore" });
    return new Uint8Array(readFileSync(join(dir, "a.heic")));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

// Ảnh HEIC dựng sẵn bằng sips, nằm trong repo: máy không có sips vẫn chạy đủ test HEIC.
export const heicFixture = (name: "heic-320x240.heic" | "heic-10240x10240-phang.heic"): Uint8Array => new Uint8Array(readFileSync(join(import.meta.dir, "../fixtures", name)));
