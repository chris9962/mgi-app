import { expect, test } from "bun:test";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const files = (dir: string): string[] =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : /\.(ts|tsx)$/.test(p) ? [p] : [];
  });

// Luật câu chữ của chủ dự án: chữ trên màn hình không xưng "Bạn".
test("chữ hiện cho người dùng không xưng Bạn", () => {
  const hits = files(join(import.meta.dir, "../../src")).filter((f) => /["'`]Bạn /.test(readFileSync(f, "utf8")));
  expect(hits).toEqual([]);
});
