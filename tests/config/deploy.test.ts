import { describe, expect, test } from "bun:test";
import { existsSync, readdirSync, readFileSync } from "node:fs";

const read = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
const scripts = readdirSync(new URL("../../deploy/", import.meta.url)).filter((f) => f.endsWith(".sh"));

describe("Nginx", () => {
  test("chuyển đúng Host, ghi đè X-Forwarded-For bằng địa chỉ thật của kết nối, báo https cho app", () => {
    const proxy = read("deploy/nginx/proxy.conf");
    expect(proxy).toContain("proxy_set_header Host $host;");
    expect(proxy).toContain("proxy_set_header X-Forwarded-For $remote_addr;");
    expect(proxy).not.toContain("$proxy_add_x_forwarded_for");
    expect(proxy).toContain("proxy_set_header X-Forwarded-Proto $scheme;");
  });

  test("giới hạn request theo IP ngưỡng cao; đường gửi ảnh có vùng riêng; trả 429", () => {
    const zones = read("deploy/nginx/limits.conf");
    const rate = (zone: string) => Number(zones.match(new RegExp(`zone=${zone}:\\S+ rate=(\\d+)r/s`))?.[1]);
    expect(rate("mgi_bank_ip")).toBeGreaterThanOrEqual(20);
    expect(rate("mgi_bank_photo")).toBeGreaterThanOrEqual(1);
    expect(zones).toContain("limit_req_status 429;");
    const app = read("deploy/nginx/app.conf");
    expect(app).toMatch(/limit_req zone=mgi_bank_ip burst=(\d{3,}) nodelay;/);
    expect(app).toMatch(/location \^~ \/api\/customers\/me\/photos[\s\S]*?limit_req zone=mgi_bank_photo/);
  });

  test("ảnh tải qua app: trần body ít nhất 20 MB ở cả hai tên miền", () => {
    const size = Number(read("deploy/nginx/app.conf").match(/client_max_body_size (\d+)m;/)?.[1]);
    expect(size).toBeGreaterThanOrEqual(20);
    const site = read("deploy/nginx/site.conf.example");
    for (const host of ["admin.minhgroup-i.com.vn", "bank.minhgroup-i.com.vn"]) expect(site).toContain(`server_name ${host};`);
    expect(site.match(/include \/opt\/mgi-bank\/deploy\/nginx\/app\.conf;/g)?.length).toBe(2);
  });
});

describe("script deploy", () => {
  test("mỗi script dừng ở lỗi đầu tiên và đúng cú pháp bash", () => {
    expect(scripts).toEqual(expect.arrayContaining(["deploy.sh", "worker-sms.sh", "worker-photo.sh", "jobs.sh", "db.sh", "test-env.sh", "maintenance-on.sh", "maintenance-off.sh"]));
    expect(scripts.some((s) => s.includes("compress"))).toBe(false);
    for (const s of scripts) {
      expect(read(`deploy/${s}`), s).toContain("set -euo pipefail");
      expect(Bun.spawnSync(["bash", "-n", `deploy/${s}`]).exitCode, s).toBe(0);
    }
  });

  test("không script nào dùng docker compose hay dựng image chạy nền song song", () => {
    for (const s of scripts) {
      const text = read(`deploy/${s}`);
      expect(text, s).not.toMatch(/docker compose|docker-compose/);
      expect(text, s).not.toMatch(/docker build[^\n]*&\s*$/m);
    }
  });

  test("app: dựng --target runner, dừng khi thiếu VOUCHER_SECRET, migrate, cổng chỉ mở 127.0.0.1, giới hạn log", () => {
    const text = read("deploy/deploy.sh") + read("deploy/lib.sh");
    expect(text).toContain("--target runner");
    expect(text).toMatch(/VOUCHER_SECRET/);
    expect(text).toContain("bun run db:migrate");
    expect(text).toMatch(/-p "?127\.0\.0\.1:/);
    expect(text).toContain("--log-opt max-size=10m");
  });

  test("app: thử sharp đổi được ảnh trong image mới trước khi chạy container thử", () => {
    const text = read("deploy/deploy.sh");
    const sharpCheck = text.indexOf('require("sharp")');
    expect(sharpCheck).toBeGreaterThan(text.indexOf("--target runner"));
    expect(sharpCheck).toBeLessThan(text.indexOf('docker run -d --name "$TEN-app-thu"'));
    expect(text.slice(sharpCheck, text.indexOf("\n", sharpCheck))).toContain(".webp(");
  });

  test("bước đọc bảng users (đăng nhập sai) chỉ chạy sau migrate: migration thêm cột users không làm bước thử image trả 500", () => {
    const text = read("deploy/deploy.sh");
    const migrate = text.indexOf("bun run db:migrate");
    const logins = [...text.matchAll(/\$\(ma_login /g)].map((m) => m.index!);
    expect(logins.length).toBeGreaterThan(0);
    for (const at of logins) expect(at).toBeGreaterThan(migrate);
    expect(text.slice(text.indexOf("== 7/7"))).toMatch(/MA_DB" = "401"/);
  });

  test("container app có trần RAM đủ cho ảnh HEIC 48 MP đổi WebP trong app (đo 1,22 GB một ảnh): production 2 ảnh cùng lúc, bản test 1 ảnh", () => {
    const gb = (text: string) => Number(text.match(/doc_env APP_MEMORY (\d+)g/)?.[1]);
    const deploy = read("deploy/deploy.sh");
    expect(gb(deploy)).toBeGreaterThanOrEqual(3);
    const runs = [...deploy.matchAll(/docker run -d --name "\$(?:APP|TEN-app-thu)"[^\n]*/g)].map((m) => m[0]);
    expect(runs.length).toBe(2);
    for (const r of runs) expect(r).toContain('--memory "$RAM_APP" --memory-swap "$RAM_APP"');
    const testEnv = read("deploy/test-env.sh");
    expect(gb(testEnv)).toBeGreaterThanOrEqual(2);
    expect(testEnv).toContain('--memory "$RAM_APP" --memory-swap "$RAM_APP"');
  });

  test("worker kiểm ảnh: thử OCR trả ready trước khi thay, trần RAM đủ cho HEIC 48 MP, chờ dừng lâu hơn hạn đọc một ảnh", () => {
    const text = read("deploy/worker-photo.sh");
    expect(text).toContain("--target photo-check");
    expect(text).toContain('{"ready": true}');
    const memory = Number(text.match(/doc_env PHOTO_CHECK_MEMORY (\d+)g/)?.[1]);
    expect(memory).toBeGreaterThanOrEqual(3);
    const grace = Number(text.match(/--stop-timeout (\d+)/)?.[1]);
    expect(grace).toBeGreaterThan(120);
  });

  test("worker SMS dựng --target sms-worker và không chạy khi chưa nối nhà cung cấp SMS mà không có cờ đồng ý", () => {
    const text = read("deploy/worker-sms.sh");
    expect(text).toContain("--target sms-worker");
    expect(text).toContain("--chap-nhan-chi-ghi-log");
  });
});

describe("tải ảnh chép mgst-app", () => {
  test("không còn worker nén, script CORS, presigned PUT", () => {
    for (const f of ["scripts/compress-worker.ts", "src/server/compress.ts", "scripts/s3-cors.ts", "src/app/api/customers/me/photos/upload-url/route.ts"]) expect(existsSync(new URL(`../../${f}`, import.meta.url)), f).toBe(false);
    expect(Object.keys(JSON.parse(read("package.json")).scripts).filter((k) => /compress|cors/.test(k))).toEqual([]);
    expect(read("src/server/storage.ts")).not.toMatch(/presignPut|CopyObjectCommand|HeadObjectCommand/);
    expect(read(".env.example")).not.toMatch(/COMPRESS|CORS/);
  });
});

describe("docs/deploy.md", () => {
  const doc = read("docs/deploy.md");

  test("có đủ bước chủ dự án phải làm", () => {
    for (const s of ["DNS", "bucket", ".env.local", "db:migrate", "db:create-admin", "db:seed", "VOUCHER_SECRET", "unaccent", "certbot", "db:restore", "test-env.sh"]) expect(doc, s).toContain(s);
    for (const s of scripts) expect(doc, s).toContain(`deploy/${s}`);
  });

  test("ghi ba container app, worker SMS, worker kiểm ảnh; không còn CORS, lifecycle uploads/, worker nén", () => {
    for (const c of ["mgi-bank-app", "mgi-bank-sms", "mgi-bank-photo"]) expect(doc).toContain(c);
    expect(doc).not.toMatch(/CORS|s3-cors|lifecycle|uploads\/|nén ảnh|compress/);
  });

  test("ghi đúng ba trần dung lượng của đường tải ảnh: Nginx 22 MB, buffer của proxy Next 22 MB, ảnh 20 MB", () => {
    expect(doc).toContain("client_max_body_size 22m");
    expect(doc).toContain("proxyClientMaxBodySize");
    expect(doc).toMatch(/20 MB/);
  });

  test("văn xuôi không dùng dấu gạch ngang dài và dấu chấm giữa", () => {
    expect(doc).not.toContain("—");
    expect(doc).not.toContain("·");
  });

  test("mọi script và unit được nhắc tới đều có thật", () => {
    for (const m of doc.matchAll(/(deploy\/[\w./@-]+\.(?:sh|conf|example|service|timer)|scripts\/[\w.-]+\.ts)/g)) expect(existsSync(new URL(`../../${m[1]}`, import.meta.url)), m[1]).toBe(true);
  });
});
