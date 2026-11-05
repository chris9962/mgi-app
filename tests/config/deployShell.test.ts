import { afterAll, describe, expect, test } from "bun:test";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Chạy deploy/lib.sh thật trong một thư mục tạm có .env.local riêng: kiểm biến mà các lệnh bun trong script nhận được.
const root = mkdtempSync(join(tmpdir(), "mgi-deploy-shell-"));
mkdirSync(join(root, "deploy"));
copyFileSync(new URL("../../deploy/lib.sh", import.meta.url), join(root, "deploy/lib.sh"));
afterAll(() => rmSync(root, { recursive: true, force: true }));

const TEST_URL = "postgres://mgibank_test:abc123abc123abc123@127.0.0.1:5437/mgibank_test";
const PROD_URL = "postgres://mgibank:prod0prod0prod0prod0@127.0.0.1:5436/mgibank";

function sourced(envLocal: string, env: Record<string, string>, print: string) {
  writeFileSync(join(root, ".env.local"), envLocal);
  const r = Bun.spawnSync(["bash", "-c", `source "${root}/deploy/lib.sh" && ${print}`], { env: { PATH: process.env.PATH ?? "", ...env } });
  return { code: r.exitCode, out: r.stdout.toString().trim(), err: r.stderr.toString() };
}

describe("deploy/lib.sh", () => {
  test("DATABASE_URL đặt sẵn trong shell không lọt vào lệnh bun của script: bản test migrate đúng DB của .env.local", () => {
    const r = sourced(`DATABASE_URL=${TEST_URL}\n`, { DATABASE_URL: PROD_URL, TEN: "mgi-bank-test", CONG_DB: "5437" }, 'echo "$DATABASE_URL"; bun -e "console.log(process.env.DATABASE_URL)"');
    expect(r.code).toBe(0);
    expect(r.out.split("\n")).toEqual([TEST_URL, TEST_URL]);
  });

  test(".env.local trỏ sai cổng thì dừng ngay lúc nạp, trước mọi lệnh", () => {
    const r = sourced(`DATABASE_URL=${PROD_URL}\n`, { TEN: "mgi-bank-test", CONG_DB: "5437" }, "echo chay-tiep");
    expect(r.code).not.toBe(0);
    expect(r.out).not.toContain("chay-tiep");
    expect(r.err).toContain("127.0.0.1:5437");
  });
});
