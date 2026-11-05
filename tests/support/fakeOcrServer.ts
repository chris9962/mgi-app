import { readFileSync } from "node:fs";
import { createInterface } from "node:readline";

// OCR giả cho test reader.ts, nói cùng giao thức JSON mỗi dòng với scripts/ocr-server.py; chữ trong file ảnh quyết định cách trả lời.
process.stdout.write(JSON.stringify({ ready: true }) + "\n");
createInterface({ input: process.stdin }).on("line", (raw) => {
  const text = readFileSync((JSON.parse(raw) as { path: string }).path, "utf8");
  if (text === "TREO") return;
  if (text === "CHET") process.exit(3);
  const reply = JSON.stringify({ lines: text.split("\n") });
  // Thư viện C ghi thẳng ra fd 1 không xuống dòng thì chữ rác dính trước JSON trên cùng dòng.
  process.stdout.write((text === "RAC" ? "W1105 paddle warning " : "") + reply + "\n");
});
