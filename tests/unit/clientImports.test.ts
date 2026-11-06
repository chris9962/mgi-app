import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });

// Component chạy ở trình duyệt không import thư mục server: server kéo theo drizzle, pg và khoá S3.
test("file use client không import @/server", () => {
  const hits = files(join(import.meta.dir, "../../src")).filter((f) => {
    const text = readFileSync(f, "utf8");
    return /^["']use client["']/.test(text) && /from ["']@\/server\//.test(text);
  });
  expect(hits.map((f) => f.slice(f.indexOf("src/")))).toEqual([]);
});
