import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const stages = (dockerfile: string) => [...dockerfile.matchAll(/^FROM \S+ AS (\S+)$/gm)].map((m) => m[1]);

describe("Docker", () => {
  test("Next dựng bản standalone để image chạy bun server.js", () => {
    expect(read("next.config.ts")).toMatch(/output:\s*"standalone"/);
  });

  test("Dockerfile có tầng app, worker SMS, worker kiểm ảnh; tầng cuối là app để build thiếu --target vẫn ra app", () => {
    const names = stages(read("Dockerfile"));
    expect(names).toEqual(expect.arrayContaining(["runner", "sms-worker", "photo-check"]));
    expect(names).not.toContain("compress-worker");
    expect(names.at(-1)).toBe("runner");
  });

  test("tầng app chạy bằng user thường, healthcheck gọi /login kèm Host tên miền quản lý", () => {
    const runner = read("Dockerfile").split(/^FROM \S+ AS runner$/m)[1];
    expect(runner).toMatch(/^USER (?!root)\S+$/m);
    expect(runner).toMatch(/HEALTHCHECK[\s\S]*Host: \$\{?ADMIN_HOST[\s\S]*\/login/);
    expect(runner).toContain('CMD ["bun", "server.js"]');
  });

  test(".dockerignore chặn file env, node_modules, .next, .git", () => {
    const ignore = read(".dockerignore").split("\n").map((l) => l.trim());
    for (const entry of [".env", ".env.*", "node_modules", ".next", ".git"]) expect(ignore).toContain(entry);
  });
});
